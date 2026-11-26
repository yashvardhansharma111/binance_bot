/**
 * Futures leg of the bot (Binance USDⓈ-M, isolated, one-way mode).
 *
 * - manageFuturesPositions(): runs every tick for every user that has open
 *   futures bot trades, whatever the current tradingMode — so switching back to
 *   spot never orphans a leveraged position.
 * - runFuturesEntries(): new entries, only when tradingMode === 'futures'.
 *
 * Signals reuse the spot indicator logic: BUY → LONG, SELL → SHORT.
 * Every position gets a stop-loss (futures never runs without one), placed on the
 * exchange as well as checked here each tick.
 */
import * as fx from '../services/binanceFutures.js';
import { calculateIndicators, detectSignal, checkMacroTrend } from '../services/indicators.js';
import { getSentiment } from '../services/sentiment.js';
import { recordTrade } from './risk.js';
import { applyCommission } from './executor.js';
import Trade from '../../lib/models/Trade.js';
import User from '../../lib/models/User.js';
import { sendTradeEmail } from '../../lib/mail.js';
import { settleDemoFutures } from '../services/demo.js';

const { MAX_FUTURES_LEVERAGE } = fx;
const MIN_HOLD_FOR_SIGNAL_EXIT_MIN = 15;

const isLong = (t) => (t.positionSide || (t.side === 'BUY' ? 'LONG' : 'SHORT')) === 'LONG';
const dirOf  = (t) => (isLong(t) ? 'LONG' : 'SHORT');
const round6 = (n) => (n == null ? null : parseFloat(Number(n).toFixed(6)));

/** Adverse price move in % (positive = losing). */
function adversePct(trade, price) {
  return isLong(trade)
    ? ((trade.price - price) / trade.price) * 100
    : ((price - trade.price) / trade.price) * 100;
}

/**
 * Pure exit decision for one position. Returns { reason, bestPrice } —
 * reason is null when the position should stay open.
 */
export function decideFuturesExit(trade, price, { maxLossPercent = 0, trailingStopPercent = 0 } = {}) {
  const long = isLong(trade);
  const prevBest = trade.trailingHighPrice || trade.price;
  const bestPrice = long ? Math.max(prevBest, price) : Math.min(prevBest, price);

  if (trade.stopLoss && (long ? price <= trade.stopLoss : price >= trade.stopLoss))
    return { reason: `Stop-loss hit @ $${price}`, bestPrice };

  if (maxLossPercent > 0) {
    const loss = adversePct(trade, price);
    if (loss >= maxLossPercent) return { reason: `Max loss ${loss.toFixed(1)}% breached (limit ${maxLossPercent}%)`, bestPrice };
  }

  if (trade.takeProfit && (long ? price >= trade.takeProfit : price <= trade.takeProfit))
    return { reason: `Take-profit hit @ $${price}`, bestPrice };

  if (trailingStopPercent > 0) {
    const trail = long ? bestPrice * (1 - trailingStopPercent / 100) : bestPrice * (1 + trailingStopPercent / 100);
    const inProfit = long ? price > trade.price : price < trade.price;
    if (inProfit && (long ? price <= trail : price >= trail))
      return { reason: `Trailing stop hit — best $${round6(bestPrice)} → stop $${round6(trail)}`, bestPrice };
  }
  return { reason: null, bestPrice };
}

/** Which way a signal points, or null. Shorts only when allowed. */
export function directionForSignal(signal, allowShort) {
  if (signal === 'BUY') return 'LONG';
  if (signal === 'SELL' && allowShort) return 'SHORT';
  return null;
}

/** Stop-loss must sit well inside the liquidation distance (80%). */
export function stopLossSafe(stopLossPercent, leverage) {
  const maxSl = fx.maxFuturesStopLoss(leverage);
  return { ok: stopLossPercent > 0 && stopLossPercent <= maxSl, maxSl };
}

/* ── closing ────────────────────────────────────────────────────────────── */

async function settle(ctx, trade, exitPrice, qty, reason, orderId) {
  const { userId, log } = ctx;
  let profit = fx.futuresPnl(dirOf(trade), trade.price, exitPrice, qty);
  // Demo: credit the virtual account (isolated margin → loss capped at margin).
  if (ctx.demo) profit = parseFloat((await settleDemoFutures(userId, trade, profit, exitPrice, qty)).toFixed(6));

  const closed = await Trade.findByIdAndUpdate(trade._id, {
    status: 'closed', closedAt: new Date(), profit,
    reason: `${trade.reason || ''} | EXIT:${reason}`,
  }, { new: true });

  // Mirror spot: a separate closing record (opposite side) carrying the P&L.
  await Trade.create({
    userId, symbol: trade.symbol, side: isLong(trade) ? 'SELL' : 'BUY',
    price: exitPrice, qty, total: exitPrice * qty, profit, orderId,
    status: 'closed', source: trade.source || 'bot', closedAt: new Date(), reason,
    market: 'futures', positionSide: dirOf(trade), leverage: trade.leverage, margin: trade.margin,
    demo: !!ctx.demo,
  });

  await recordTrade(userId);
  if (profit > 0 && !ctx.demo) await applyCommission(userId, closed._id, profit);

  const roi = trade.margin ? ` (${((profit / trade.margin) * 100).toFixed(1)}% on margin)` : '';
  await log(userId, profit >= 0 ? 'info' : 'warn',
    `${ctx.demo ? '[DEMO] ' : ''}${profit >= 0 ? '✅' : '❌'} FUTURES CLOSE ${dirOf(trade)} ${trade.symbol} @ $${exitPrice} | P&L: ${profit >= 0 ? '+' : ''}$${profit}${roi} | ${reason}`);

  const u = ctx.demo ? null : await User.findById(userId).select('email name').lean();
  if (u) sendTradeEmail(u.email, u.name, isLong(trade) ? 'SELL' : 'BUY',
    { symbol: trade.symbol, price: exitPrice, qty, profit, reason }).catch(() => {});
  return profit;
}

export async function closeFuturesTrade(ctx, trade, reason) {
  const res = await ctx.fut.closeMarket(trade.symbol, dirOf(trade), trade.qty);
  await ctx.fut.cancelAllOrders(trade.symbol);
  const note = res.alreadyFlat ? `${reason} (position was already closed on exchange)` : reason;
  return settle(ctx, trade, res.price, res.qty || trade.qty, note, res.orderId);
}

/* ── exit loop ──────────────────────────────────────────────────────────── */

export async function manageFuturesPositions(ctx) {
  const { userId, settings, exchangeName, log, symCfg } = ctx;
  const open = await Trade.find({ userId, status: 'open', market: 'futures', source: { $ne: 'manual' }, ...ctx.scope });
  if (!open.length) return [];

  if (!ctx.demo && exchangeName !== 'binance') {
    await log(userId, 'error', `⚠️ ${open.length} futures position(s) open but the active key is ${exchangeName.toUpperCase()} — manage them on Binance manually`);
    return open;
  }

  const stillOpen = [];
  for (const trade of open) {
    try {
      const price = await fx.getMarkPrice(trade.symbol);
      if (!price) { stillOpen.push(trade); continue; }

      // Closed on the exchange (exchange SL/TP fired, liquidation, or manual close)?
      // Demo has no exchange to liquidate — enforce the liquidation price here.
      if (ctx.demo && trade.liquidationPrice && (isLong(trade) ? price <= trade.liquidationPrice : price >= trade.liquidationPrice)) {
        await settle(ctx, trade, trade.liquidationPrice, trade.qty, `LIQUIDATED @ $${round6(trade.liquidationPrice)}`);
        continue;
      }

      const pos = await ctx.fut.getPosition(trade.symbol);
      if (pos && pos.positionAmt === 0) {
        const long = isLong(trade);
        let exit = price, why = 'closed on exchange';
        if (trade.stopLoss && (long ? price <= trade.stopLoss : price >= trade.stopLoss)) { exit = trade.stopLoss; why = 'exchange stop-loss'; }
        else if (trade.takeProfit && (long ? price >= trade.takeProfit : price <= trade.takeProfit)) { exit = trade.takeProfit; why = 'exchange take-profit'; }
        else if (trade.liquidationPrice && (long ? price <= trade.liquidationPrice : price >= trade.liquidationPrice)) { exit = trade.liquidationPrice; why = 'LIQUIDATED'; }
        await ctx.fut.cancelAllOrders(trade.symbol);
        await settle(ctx, trade, exit, trade.qty, `Position ${why} (estimated exit $${round6(exit)})`);
        continue;
      }

      const sc = symCfg(settings, trade.symbol);
      const { reason, bestPrice } = decideFuturesExit(trade, price, {
        maxLossPercent: settings.maxLossPercent ?? 0,
        trailingStopPercent: sc.trailingStopPercent,
      });
      if (bestPrice !== (trade.trailingHighPrice || trade.price)) {
        await Trade.findByIdAndUpdate(trade._id, { trailingHighPrice: bestPrice });
        trade.trailingHighPrice = bestPrice;
      }
      if (reason) { await closeFuturesTrade(ctx, trade, reason); continue; }

      // Opposite signal → exit (after a minimum hold, like spot).
      const heldMin = (Date.now() - new Date(trade.createdAt).getTime()) / 60000;
      if (heldMin >= MIN_HOLD_FOR_SIGNAL_EXIT_MIN) {
        const candles = await fx.getFuturesCandles(trade.symbol, settings.timeframe, 120);
        if (candles.length >= 100) {
          const ind = calculateIndicators(candles);
          const sig = detectSignal(ind, settings.aggressiveMode, settings.respectMacroInAggressive !== false);
          if ((isLong(trade) && sig === 'SELL') || (!isLong(trade) && sig === 'BUY')) {
            await closeFuturesTrade(ctx, trade, `${sig} signal against ${dirOf(trade)} — RSI:${ind.rsi}`);
            continue;
          }
        }
      }

      const upnl = fx.futuresPnl(dirOf(trade), trade.price, price, trade.qty);
      await log(userId, 'info',
        `Holding FUTURES ${dirOf(trade)} ${trade.leverage}x ${trade.symbol} @ $${trade.price} | Now $${price} | uPnL ${upnl >= 0 ? '+' : ''}$${upnl} | SL $${trade.stopLoss} TP $${trade.takeProfit}${trade.liquidationPrice ? ` | Liq $${trade.liquidationPrice}` : ''}`);
      stillOpen.push(trade);
    } catch (e) {
      await log(userId, 'error', `[${trade.symbol}] Futures position check failed: ${e.message}`);
      stillOpen.push(trade);
    }
  }
  return stillOpen;
}

/* ── entries ────────────────────────────────────────────────────────────── */

export async function runFuturesEntries(ctx) {
  const { userId, settings, exchangeName, log, symCfg } = ctx;

  if (!ctx.demo && exchangeName !== 'binance')
    return log(userId, 'warn', `Futures mode needs a Binance API key — active key is ${exchangeName.toUpperCase()}. No futures entries.`);

  const leverage   = Math.min(MAX_FUTURES_LEVERAGE, Math.max(1, Math.round(settings.futuresLeverage || 3)));
  const allowShort = settings.futuresAllowShort !== false;
  const aggressive = !!settings.aggressiveMode;
  const symbols    = settings.symbols?.length ? settings.symbols : [settings.symbol || 'BTCUSDT'];

  // Risk gates shared by every symbol this tick.
  const today = new Date().toISOString().slice(0, 10);
  if (settings.dailyTradeDate === today && settings.dailyTradeCount >= settings.maxDailyTrades)
    return log(userId, 'info', `Futures: daily trade limit reached (${settings.maxDailyTrades})`);
  if (!aggressive && settings.lastTradeAt) {
    const left = settings.cooldownMinutes * 60_000 - (Date.now() - new Date(settings.lastTradeAt).getTime());
    if (left > 0) return log(userId, 'info', `Futures: cooldown ${(left / 60000).toFixed(1)}m left`);
  }

  let balance = await ctx.fut.getAvailableBalance();
  await log(userId, 'info',
    `💰 ${ctx.demo ? '[DEMO] ' : ''}Futures USDT available: $${balance.toFixed(2)} | ${leverage}x isolated | shorts ${allowShort ? 'ON' : 'OFF'} | ${symbols.join(', ')}`);

  const openSyms = new Set((await Trade.find({ userId, status: 'open', market: 'futures', ...ctx.scope }).select('symbol').lean()).map(t => t.symbol));
  let placed = 0;

  for (const sym of symbols) {
    try {
      if (openSyms.has(sym)) continue;                          // one futures position per symbol
      if (balance < 10) { await log(userId, 'info', `Futures: low available margin $${balance.toFixed(2)} — no more entries`); break; }

      const rules = await fx.getSymbolRules(sym);
      if (!rules) { await log(userId, 'warn', `[${sym}] Not a Binance USDⓈ-M perpetual — skipped in futures mode`); continue; }

      const sc = symCfg(settings, sym);
      const slCheck = stopLossSafe(sc.stopLossPercent, leverage);
      if (!slCheck.ok) {
        await log(userId, 'error', `[${sym}] ⛔ Stop loss ${sc.stopLossPercent}% is too close to liquidation at ${leverage}x — use ≤ ${slCheck.maxSl}% or lower leverage`);
        continue;
      }

      const candles = await fx.getFuturesCandles(sym, settings.timeframe, 120);
      if (candles.length < 100) { await log(userId, 'warn', `[${sym}] Only ${candles.length} futures candles — skipped`); continue; }
      const ind = calculateIndicators(candles);
      const signal = detectSignal(ind, aggressive, settings.respectMacroInAggressive !== false);
      const direction = directionForSignal(signal, allowShort);
      if (!direction) { await log(userId, 'info', `[${sym}] FUTURES ${signal}${signal === 'SELL' ? ' (shorts off)' : ''} — RSI ${ind.rsi}, no entry`); continue; }

      // Trend guards (mirror of spot's long-only guards).
      if (direction === 'SHORT' && ind.macroUptrend && (!aggressive || settings.respectMacroInAggressive !== false)) {
        await log(userId, 'info', `[${sym}] SHORT skipped — price above EMA100 (macro uptrend)`); continue;
      }
      if (!aggressive) {
        const ch = await fx.getFutures24hChange(sym);
        if (direction === 'LONG' && ch < -2) { await log(userId, 'warn', `[${sym}] ⛔ LONG blocked — 24h ${ch.toFixed(2)}%`); continue; }
        if (direction === 'SHORT' && ch > 2) { await log(userId, 'warn', `[${sym}] ⛔ SHORT blocked — 24h +${ch.toFixed(2)}%`); continue; }
        const h1up = checkMacroTrend(await fx.getFuturesCandles(sym, '1h', 60));
        if (direction === 'LONG' && !h1up) { await log(userId, 'warn', `[${sym}] ⛔ LONG blocked — 1h trend bearish`); continue; }
        if (direction === 'SHORT' && h1up) { await log(userId, 'warn', `[${sym}] ⛔ SHORT blocked — 1h trend bullish`); continue; }

        // Opening records only (reason starts "Futures …") — the closing records carry the same P&L.
        const last2 = await Trade.find({ userId, symbol: sym, market: 'futures', status: 'closed', closedAt: { $ne: null }, source: 'bot', reason: /^Futures /, ...ctx.scope })
          .sort({ closedAt: -1 }).limit(2).lean();
        const losers = last2.filter(t => (t.profit || 0) < 0);
        if (losers.length === 2 && Date.now() - new Date(last2[0].closedAt).getTime() < 6 * 3600_000) {
          await log(userId, 'warn', `[${sym}] ⛔ Futures: 2 losses in a row — 6h cooldown`); continue;
        }

        if (settings.useGroqFilter) {
          const s = await getSentiment(sym, ind);
          const against = direction === 'LONG' ? 'bearish' : 'bullish';
          if (s.sentiment === against && s.confidence >= 65) {
            await log(userId, 'warn', `[${sym}] ⛔ ${direction} blocked — AI sentiment ${s.sentiment} (${s.confidence}%)`); continue;
          }
        }
      }

      // The bot may have been stopped (by the user or the admin) after this tick began.
      const fresh = await User.findById(userId).select('botActive').lean();
      if (!fresh?.botActive) { await log(userId, 'warn', `[${sym}] ⏹ Bot stopped mid-tick — futures entry cancelled`); break; }

      const margin = Math.min(sc.tradeUSDT, balance * 0.95);
      const mark   = await fx.getMarkPrice(sym);
      const qty    = fx.sizePosition(rules, mark, margin, leverage);

      await log(userId, 'info', `[${sym}] 🚀 FUTURES ${direction} ${leverage}x — margin $${margin.toFixed(2)} (notional $${(qty * mark).toFixed(2)})`);
      await ctx.fut.prepareSymbol(sym, leverage);
      const order = await ctx.fut.openMarket(sym, direction, qty);

      const lv = fx.futuresLevels(order.price, direction, sc.stopLossPercent, sc.takeProfitPercent);
      const stopLoss   = fx.roundPrice(lv.stopLoss, rules.tickSize);
      const takeProfit = lv.takeProfit ? fx.roundPrice(lv.takeProfit, rules.tickSize) : null;
      const prot = await ctx.fut.placeProtection(sym, direction, { stopLoss, takeProfit }, rules.tickSize);
      if (prot.errors.length)
        await log(userId, 'error', `[${sym}] ⚠️ Exchange SL/TP not placed (${prot.errors.join('; ')}) — bot will still enforce them every tick`);
      const pos = await ctx.fut.getPosition(sym).catch(() => null);
      const liquidationPrice = order.liquidationPrice ?? pos?.liquidationPrice ?? null;

      await Trade.create({
        userId, symbol: sym, side: direction === 'LONG' ? 'BUY' : 'SELL',
        price: order.price, qty: order.qty, total: order.price * order.qty,
        stopLoss, takeProfit, orderId: order.orderId, status: 'open', source: 'bot',
        market: 'futures', positionSide: direction, leverage,
        margin: parseFloat(((order.price * order.qty) / leverage).toFixed(4)),
        liquidationPrice, demo: !!ctx.demo,
        protectionIds: { stopLossId: prot.stopLossId, takeProfitId: prot.takeProfitId },
        reason: `Futures ${direction} ${leverage}x | RSI:${ind.rsi}`,
      });
      await recordTrade(userId);
      await log(userId, 'info',
        `${ctx.demo ? '[DEMO] ' : ''}✅ FUTURES ${direction} ${sym} @ $${order.price} qty ${order.qty} | SL $${stopLoss} TP ${takeProfit ? '$' + takeProfit : 'off'}${liquidationPrice ? ` | Liq $${round6(liquidationPrice)}` : ''}`);

      const u = ctx.demo ? null : await User.findById(userId).select('email name').lean();
      if (u) sendTradeEmail(u.email, u.name, direction === 'LONG' ? 'BUY' : 'SELL', {
        symbol: sym, price: order.price, qty: order.qty, total: order.price * order.qty,
        stopLoss, takeProfit, reason: `Futures ${direction} ${leverage}x`,
      }).catch(() => {});

      balance -= margin;
      openSyms.add(sym);
      placed++;
      if (!aggressive) break;   // respect cooldown: one entry per tick outside aggressive mode
    } catch (e) {
      await log(userId, 'error', `[${sym}] ❌ Futures entry failed: ${e.message}`);
    }
  }
  await log(userId, 'info', `📋 FUTURES TICK DONE — ${placed ? `✅ ${placed} position(s) opened` : '💤 no new positions'}`);
}
