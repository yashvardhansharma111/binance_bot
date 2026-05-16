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

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  const keyDoc = await ApiKey.findOne({ userId: user._id, isActive: true });
  if (!keyDoc) return NextResponse.json({ error: 'No active API key. Add one in API Keys.' }, { status: 400 });

  let apiKey, apiSecret;
  try {
    apiKey    = decrypt(keyDoc.encryptedKey);
    apiSecret = decrypt(keyDoc.encryptedSecret);
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt API keys' }, { status: 500 });
  }

  try {
    let order;
    if (side === 'BUY') {
      if (!usdtAmount || usdtAmount < 1)
        return NextResponse.json({ error: 'Enter USDT amount to spend' }, { status: 400 });
      order = await placeMarketBuy(apiKey, apiSecret, symbol, parseFloat(usdtAmount));
    } else {
      // SELL: find open BUY trade or use provided qty
      if (qty) {
        order = await placeMarketSell(apiKey, apiSecret, symbol, parseFloat(qty));
      } else {
        const openTrade = await Trade.findOne({ userId: user._id, symbol, side: 'BUY', status: 'open' });
        if (!openTrade) return NextResponse.json({ error: 'No open position to sell' }, { status: 400 });
        order = await placeMarketSell(apiKey, apiSecret, symbol, openTrade.qty);
        // Close the matched open trade
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
