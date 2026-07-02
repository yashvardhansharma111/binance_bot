import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import ApiKey from '@/lib/models/ApiKey';
import Trade from '@/lib/models/Trade';
import User from '@/lib/models/User';
import Commission from '@/lib/models/Commission';
import { decrypt } from '@/lib/encryption';
import { getExchange } from '@/bot/services/exchange';

const TOTAL_COMMISSION_RATE = 15;
const REFERRER_RATE         = 10;
const PLATFORM_RATE_WITH    = 5;
const PLATFORM_RATE_WITHOUT = 15;

async function applyCommission(user, tradeId, profit) {
  if (profit <= 0) return;

  const totalCut = parseFloat((profit * TOTAL_COMMISSION_RATE / 100).toFixed(8));

  let referrerId     = null;
  let referrerAmount = 0;
  let platformAmount = totalCut;
  let platformRate   = PLATFORM_RATE_WITHOUT;
  let referrerRate   = 0;

  if (user.referredBy) {
    const referrer = await User.findOne({ referralCode: user.referredBy });
    if (referrer) {
      referrerId     = referrer._id;
      referrerAmount = parseFloat((profit * REFERRER_RATE / 100).toFixed(8));
      platformAmount = parseFloat((profit * PLATFORM_RATE_WITH / 100).toFixed(8));
      platformRate   = PLATFORM_RATE_WITH;
      referrerRate   = REFERRER_RATE;
      await User.findByIdAndUpdate(referrer._id, { $inc: { assetBalance: referrerAmount } });
    }
  }

  await User.findByIdAndUpdate(user._id, { $inc: { assetBalance: -totalCut } });

  await Commission.create({
    tradeId, userId: user._id, referrerId, profit,
    platformRate, referrerRate, platformAmount, referrerAmount,
    totalAmount: totalCut,
  });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tradeId } = await req.json();
  if (!tradeId) return NextResponse.json({ error: 'tradeId required' }, { status: 400 });

  await connectDB();
  const user = await User.findOne({ email: session.user.email });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const trade = await Trade.findOne({ _id: tradeId, userId: user._id, status: 'open' });
  if (!trade) return NextResponse.json({ error: 'Open trade not found' }, { status: 404 });

  const keyDoc = await ApiKey.findOne({ userId: user._id, isActive: true });
  if (!keyDoc) return NextResponse.json({ error: 'No active API key' }, { status: 400 });

  const exchange   = keyDoc.exchange || 'binance';
  const isTestnet  = keyDoc.accountType === 'testnet';
  const apiKey     = decrypt(keyDoc.encryptedKey);
  const apiSecret  = decrypt(keyDoc.encryptedSecret);
  const { placeMarketSell } = getExchange(exchange);

  let order, profit;
  try {
    order  = await placeMarketSell(apiKey, apiSecret, trade.symbol, trade.qty, isTestnet);
    profit = parseFloat(((order.price - trade.price) * order.qty).toFixed(6));
  } catch (e) {
    const isInsufficient = e.message.includes('-2010') || e.message.includes('insufficient balance')
      || e.message.includes('Insufficient') || e.message.includes('balance not enough');
    const isTooSmall     = e.message.includes('-1013') || e.message.includes('notional too small');

    if (isInsufficient) {
      // Check actual coin balance on exchange before treating as phantom
      const { getAssetBalance } = getExchange(exchange);
      const actualBalance = await getAssetBalance(apiKey, apiSecret, trade.symbol, isTestnet).catch(() => 0);

      if (actualBalance > 0) {
        // Coins still on exchange — sell the real amount
        const { placeMarketSell: sellFn } = getExchange(exchange);
        try {
          order  = await sellFn(apiKey, apiSecret, trade.symbol, actualBalance, isTestnet);
          profit = parseFloat(((order.price - trade.price) * order.qty).toFixed(6));
        } catch (e2) {
          return NextResponse.json({ error: `Sell failed (balance=${actualBalance}): ${e2.message} — please sell manually on exchange` }, { status: 500 });
        }
      } else {
        // Balance = 0 — position already closed on exchange by SL/TP
        const exitPrice = trade.takeProfit && trade.stopLoss
          ? (trade.price > trade.stopLoss ? trade.takeProfit : trade.stopLoss)
          : (trade.stopLoss || trade.takeProfit || trade.price);
        profit = parseFloat(((exitPrice - trade.price) * trade.qty).toFixed(6));
        order  = { price: exitPrice };
      }
    } else if (isTooSmall) {
      const exitPrice = trade.stopLoss || trade.takeProfit || trade.price;
      profit = parseFloat(((exitPrice - trade.price) * trade.qty).toFixed(6));
      order  = { price: exitPrice };
    } else {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  const closedTrade = await Trade.findByIdAndUpdate(trade._id, {
    status: 'closed', closedAt: new Date(), profit, reason: 'Manual exit',
  }, { new: true });

  await applyCommission(user, closedTrade._id, profit);

  return NextResponse.json({ order, profit });
}
