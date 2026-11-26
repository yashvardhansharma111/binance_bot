import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import ApiKey from '@/lib/models/ApiKey';
import Trade from '@/lib/models/Trade';
import User from '@/lib/models/User';
import { decrypt } from '@/lib/encryption';
import * as fx from '@/bot/services/binanceFutures';
import { demoFuturesVenue, virtualKindOf } from '@/bot/services/demo';

/** Manual futures order (user-initiated). The bot never manages these. */
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { symbol, side, usdtMargin, leverage = 10, stopLossPercent, takeProfitPercent } = await req.json();

  if (!symbol || !/^[A-Z0-9]{2,20}$/.test(symbol))
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  if (!['BUY', 'SELL'].includes(side))
    return NextResponse.json({ error: 'Side must be BUY or SELL' }, { status: 400 });
  if (!usdtMargin || usdtMargin < 5)
    return NextResponse.json({ error: 'Minimum margin is $5' }, { status: 400 });
  if (!Number.isInteger(Number(leverage)) || leverage < 1 || leverage > 125)
    return NextResponse.json({ error: 'Leverage must be 1–125' }, { status: 400 });
  if (stopLossPercent !== undefined && (stopLossPercent < 0.1 || stopLossPercent > 50))
    return NextResponse.json({ error: 'Stop loss must be 0.1–50%' }, { status: 400 });
  if (takeProfitPercent !== undefined && (takeProfitPercent < 0.1 || takeProfitPercent > 500))
    return NextResponse.json({ error: 'Take profit must be 0.1–500%' }, { status: 400 });
  if (stopLossPercent && stopLossPercent >= fx.liquidationDistancePct(leverage))
    return NextResponse.json({
      error: `Stop loss ${stopLossPercent}% is beyond the ~${fx.liquidationDistancePct(leverage).toFixed(1)}% liquidation distance at ${leverage}x — it would never trigger`,
    }, { status: 400 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const vkind = virtualKindOf(user);
  const demo = vkind !== null;
  const dryRun = process.env.DRY_RUN === 'true';
  let venue;
  if (demo) {
    venue = demoFuturesVenue(user._id, vkind);
  } else {
    const keyDoc = await ApiKey.findOne({ userId: user._id, isActive: true });
    if (!keyDoc) return NextResponse.json({ error: 'No active API key. Add one in API Keys.' }, { status: 400 });
    if ((keyDoc.exchange || 'binance') !== 'binance')
      return NextResponse.json({ error: 'Futures trading is available with a Binance API key only.' }, { status: 400 });
    const isTestnet = keyDoc.accountType === 'testnet';
    if (isTestnet && !dryRun)
      return NextResponse.json({
        error: 'Futures trading requires a live Binance account. Testnet API keys only support spot trading — switch to a real Binance API key in API Keys settings.',
      }, { status: 400 });
    try {
      venue = fx.liveFuturesVenue(decrypt(keyDoc.encryptedKey), decrypt(keyDoc.encryptedSecret), isTestnet);
    } catch {
      return NextResponse.json({ error: 'Failed to decrypt API keys' }, { status: 500 });
    }
  }

  try {
    const direction = side === 'BUY' ? 'LONG' : 'SHORT';
    const rules = await fx.getSymbolRules(symbol);
    if (!rules) return NextResponse.json({ error: `${symbol} is not a Binance USDⓈ-M perpetual` }, { status: 400 });

    const mark = await fx.getMarkPrice(symbol);
    let qty;
    try { qty = fx.sizePosition(rules, mark, usdtMargin, leverage); }
    catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }

    await venue.prepareSymbol(symbol, leverage);
    const order = await venue.openMarket(symbol, direction, qty);

    const lv = fx.futuresLevels(order.price, direction, stopLossPercent, takeProfitPercent);
    const stopLoss   = lv.stopLoss   ? fx.roundPrice(lv.stopLoss, rules.tickSize)   : null;
    const takeProfit = lv.takeProfit ? fx.roundPrice(lv.takeProfit, rules.tickSize) : null;
    const prot = await venue.placeProtection(symbol, direction, { stopLoss, takeProfit }, rules.tickSize);
    if (prot.errors.length) console.warn(`[futures] protection failed for ${user.email} ${symbol}: ${prot.errors.join('; ')}`);
    const pos = await venue.getPosition(symbol).catch(() => null);

    const trade = await Trade.create({
      userId:     user._id,
      symbol,
      side,
      price:      order.price,
      qty:        order.qty,
      total:      order.price * order.qty,
      stopLoss,
      takeProfit,
      orderId:    order.orderId,
      status:     'open',
      source:     'manual',
      market:     'futures',
      positionSide: direction,
      leverage,
      margin:     parseFloat(((order.price * order.qty) / leverage).toFixed(4)),
      liquidationPrice: order.liquidationPrice ?? pos?.liquidationPrice ?? null,
      demo,
      virtualAccount: vkind,
      protectionIds: { stopLossId: prot.stopLossId, takeProfitId: prot.takeProfitId },
      reason:     `Futures ${direction} ${leverage}x`,
    });

    return NextResponse.json({
      trade, leverage, margin: usdtMargin, dryRun,
      ...(prot.errors.length ? { warning: `Position opened but exchange SL/TP failed: ${prot.errors.join('; ')}` } : {}),
    });
  } catch (err) {
    console.error('[futures] Order failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
