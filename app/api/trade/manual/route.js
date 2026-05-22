import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import ApiKey from '@/lib/models/ApiKey';
import Trade from '@/lib/models/Trade';
import User from '@/lib/models/User';
import { decrypt } from '@/lib/encryption';
import { placeMarketBuy, placeMarketSell, getCurrentPrice } from '@/bot/services/binance';

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { symbol, side, usdtAmount, qty, stopLossPercent, takeProfitPercent } = await req.json();

  if (!symbol) return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
  if (!['BUY','SELL'].includes(side)) return NextResponse.json({ error: 'Side must be BUY or SELL' }, { status: 400 });

  console.log(`[manual-trade] ${side} ${symbol} from ${session.user.email}`);

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const keyDoc = await ApiKey.findOne({ userId: user._id, isActive: true });
  if (!keyDoc) return NextResponse.json({ error: 'No active API key. Add one in API Keys.' }, { status: 400 });

  const isTestnet = keyDoc.accountType === 'testnet';
  console.log(`[manual-trade] keyDoc found — accountType=${keyDoc.accountType} isTestnet=${isTestnet}`);

  let apiKey, apiSecret;
  try {
    apiKey    = decrypt(keyDoc.encryptedKey);
    apiSecret = decrypt(keyDoc.encryptedSecret);
    console.log(`[manual-trade] Keys decrypted — apiKey prefix=${apiKey?.slice(0, 6)}...`);
  } catch (e) {
    console.error(`[manual-trade] Key decrypt failed:`, e);
    return NextResponse.json({ error: 'Failed to decrypt API keys' }, { status: 500 });
  }

  try {
    let order;
    if (side === 'BUY') {
      if (!usdtAmount || usdtAmount < 10)
        return NextResponse.json({ error: 'Minimum order is $10 (Binance notional filter)' }, { status: 400 });
      console.log(`[manual-trade] Placing BUY ${symbol} $${usdtAmount} testnet=${isTestnet}`);
      order = await placeMarketBuy(apiKey, apiSecret, symbol, parseFloat(usdtAmount), isTestnet);
    } else {
      // SELL: find open BUY trade or use provided qty
      if (qty) {
        console.log(`[manual-trade] Placing SELL ${symbol} qty=${qty} testnet=${isTestnet}`);
        order = await placeMarketSell(apiKey, apiSecret, symbol, parseFloat(qty), isTestnet);
      } else {
        const openTrade = await Trade.findOne({ userId: user._id, symbol, side: 'BUY', status: 'open' });
        if (!openTrade) return NextResponse.json({ error: 'No open position to sell' }, { status: 400 });
        console.log(`[manual-trade] Placing SELL ${symbol} qty=${openTrade.qty} (from open trade) testnet=${isTestnet}`);
        order = await placeMarketSell(apiKey, apiSecret, symbol, openTrade.qty, isTestnet);
        const profit = parseFloat(((order.price - openTrade.price) * openTrade.qty).toFixed(6));
        await Trade.findByIdAndUpdate(openTrade._id, { status: 'closed', closedAt: new Date(), profit });
      }
    }

    console.log(`[manual-trade] Order placed:`, JSON.stringify(order));

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
