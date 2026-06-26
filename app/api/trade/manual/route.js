import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import ApiKey from '@/lib/models/ApiKey';
import Trade from '@/lib/models/Trade';
import User from '@/lib/models/User';
import { decrypt } from '@/lib/encryption';
import { getExchange } from '@/bot/services/exchange';

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { symbol, side, usdtAmount, qty, stopLossPercent, takeProfitPercent } = await req.json();

  if (!symbol || !/^[A-Z0-9]{2,20}$/.test(symbol))
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  if (!['BUY','SELL'].includes(side))
    return NextResponse.json({ error: 'Side must be BUY or SELL' }, { status: 400 });
  if (stopLossPercent !== undefined && (stopLossPercent < 0.1 || stopLossPercent > 50))
    return NextResponse.json({ error: 'Stop loss must be 0.1–50%' }, { status: 400 });
  if (takeProfitPercent !== undefined && (takeProfitPercent < 0.1 || takeProfitPercent > 100))
    return NextResponse.json({ error: 'Take profit must be 0.1–100%' }, { status: 400 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if ((user.assetBalance ?? 0) < 10)
    return NextResponse.json({ error: 'You need at least $10 in Asset Balance to trade. Please deposit first.' }, { status: 400 });

  const keyDoc = await ApiKey.findOne({ userId: user._id, isActive: true });
  if (!keyDoc) return NextResponse.json({ error: 'No active API key. Add one in API Keys.' }, { status: 400 });

  const exchange   = keyDoc.exchange || 'binance';
  const isTestnet  = keyDoc.accountType === 'testnet';
  const { placeMarketBuy, placeMarketSell } = getExchange(exchange);

  let apiKey, apiSecret;
  try {
    apiKey    = decrypt(keyDoc.encryptedKey);
    apiSecret = decrypt(keyDoc.encryptedSecret);
  } catch (e) {
    console.error(`[manual-trade] Key decrypt failed`);
    return NextResponse.json({ error: 'Failed to decrypt API keys' }, { status: 500 });
  }

  try {
    let order;
    if (side === 'BUY') {
      const spend = parseFloat(usdtAmount);
      if (!spend || spend < 10 || spend > 50000)
        return NextResponse.json({ error: 'Amount must be between $10 and $50,000' }, { status: 400 });
      order = await placeMarketBuy(apiKey, apiSecret, symbol, spend, isTestnet);
    } else {
      // SELL: find open BUY trade or use provided qty
      if (qty) {
        order = await placeMarketSell(apiKey, apiSecret, symbol, parseFloat(qty), isTestnet);
      } else {
        const openTrade = await Trade.findOne({ userId: user._id, symbol, side: 'BUY', status: 'open' });
        if (!openTrade) return NextResponse.json({ error: 'No open position to sell' }, { status: 400 });
        order = await placeMarketSell(apiKey, apiSecret, symbol, openTrade.qty, isTestnet);
        const profit = parseFloat(((order.price - openTrade.price) * openTrade.qty).toFixed(6));
        await Trade.findByIdAndUpdate(openTrade._id, { status: 'closed', closedAt: new Date(), profit });
      }
    }

    const sl = stopLossPercent  ? parseFloat((order.price * (1 - stopLossPercent / 100)).toFixed(6))  : null;
    const tp = takeProfitPercent ? parseFloat((order.price * (1 + takeProfitPercent / 100)).toFixed(6)) : null;

    const trade = await Trade.create({
      userId:     user._id,
      symbol,
      side,
      price:      order.price,
      qty:        order.qty,
      total:      order.total,
      stopLoss:   sl,
      takeProfit: tp,
      orderId:    order.orderId,
      status:     side === 'BUY' ? 'open' : 'closed',
      source:     'manual',
      reason:     'Manual trade',
    });

    return NextResponse.json({ trade, order });
  } catch (err) {
    console.error(`[manual-trade] Order failed:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
