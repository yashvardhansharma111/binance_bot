/**
 * Pre-trade checklist — 10 independent confirmations before any new entry.
 *
 * Pure function: no network, no DB. The caller supplies candles and context, so
 * the same code runs in the live bot, the futures engine and the backtester.
 * Mirrored for SHORT. A check that cannot be evaluated (missing data, AI filter
 * off) is marked `skipped` and counts as passed.
 */
import { RSI, MACD, EMA, ATR } from 'technicalindicators';

export const CHECKLIST_SIZE = 10;
const ROUND_TRIP_FEE_PCT = 0.2;           // 0.1% in + 0.1% out (spot taker)

const last = (a, n = 1) => a[a.length - n];

/** Indicator snapshot the checks need, from the entry-timeframe candles. */
export function checklistIndicators(candles) {
  const closes = candles.map(c => c.close);
  const rsi = RSI.calculate({ values: closes, period: 14 });
  const macd = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
  const ema20 = EMA.calculate({ values: closes, period: 20 });
  const ema50 = EMA.calculate({ values: closes, period: 50 });
  const atr = ATR.calculate({ high: candles.map(c => c.high), low: candles.map(c => c.low), close: closes, period: 14 });
  // Volume uses the last CLOSED candle: Binance returns the still-forming candle
  // last, whose volume is always small and would fail this check every tick.
  const vols = candles.map(c => c.volume);
  const lastClosedVol = vols[vols.length - 2] ?? 0;
  const avgVol = vols.slice(-22, -2).reduce((a, b) => a + b, 0) / 20;
  const hist = (m) => (m ? m.MACD - m.signal : 0);
  return {
    price: last(closes),
    rsi: last(rsi), rsiPrev: last(rsi, 2),
    hist: hist(last(macd)), histPrev: hist(last(macd, 2)),
    ema20: last(ema20), ema50: last(ema50),
    atr: last(atr),
    volRatio: avgVol > 0 ? lastClosedVol / avgVol : 1,
  };
}

/** Is price above (LONG) / below (SHORT) the 200-EMA of these closes? null = not enough data. */
function vsEma200(closes) {
  if (closes.length < 200) return null;
  const e = last(EMA.calculate({ values: closes, period: 200 }));
  return { above: last(closes) > e, ema: e };
}

function emaTrendUp(closes) {
  if (closes.length < 50) return null;
  return last(EMA.calculate({ values: closes, period: 20 })) > last(EMA.calculate({ values: closes, period: 50 }));
}

/**
 * @param {object} p
 * @param {'LONG'|'SHORT'} p.direction
 * @param {string}  p.signal          strategy signal: BUY | SELL | HOLD
 * @param {object}  p.ind             checklistIndicators(entry candles)
 * @param {number[]} p.h1Closes       1h closes (≥200 for the higher-timeframe trend)
 * @param {number[]|null} p.btcH1Closes  BTC 1h closes (null when trading BTC itself → use h1Closes)
 * @param {number|null} p.btc24h      BTC 24h change %
 * @param {number}  p.takeProfitPercent
 * @param {object|null} p.sentiment   { sentiment, confidence } or null when the AI filter is off
 * @returns {{ checks: object[], passed: number, total: number, ok: boolean }}
 */
export function runChecklist({ direction, signal, ind, h1Closes, btcH1Closes, btc24h, takeProfitPercent, sentiment, minPass = CHECKLIST_SIZE }) {
  const L = direction === 'LONG';
  const checks = [];
  const add = (id, name, pass, detail, skipped = false) => checks.push({ id, name, pass: skipped ? true : !!pass, skipped, detail });
  const pct = (n) => `${n.toFixed(2)}%`;

  add('signal', 'Strategy signal', signal === (L ? 'BUY' : 'SELL'), `signal ${signal}`);

  const htf = vsEma200(h1Closes);
  add('htfTrend', '1h trend (EMA200)', htf && (L ? htf.above : !htf.above),
    htf ? `price ${L ? (htf.above ? 'above' : 'below') : (htf.above ? 'above' : 'below')} 1h EMA200` : 'not enough 1h data', !htf);

  add('localTrend', 'Local trend (EMA20/50)', L ? ind.ema20 > ind.ema50 : ind.ema20 < ind.ema50,
    `EMA20 ${ind.ema20 > ind.ema50 ? '>' : '<'} EMA50`);

  add('rsiTurn', 'RSI turning', L ? ind.rsi > ind.rsiPrev && ind.rsi < 60 : ind.rsi < ind.rsiPrev && ind.rsi > 40,
    `RSI ${ind.rsiPrev?.toFixed(1)} → ${ind.rsi?.toFixed(1)}`);

  add('momentum', 'MACD momentum', L ? ind.hist > ind.histPrev : ind.hist < ind.histPrev,
    `histogram ${ind.hist > ind.histPrev ? 'rising' : 'falling'}`);

  add('volume', 'Volume', ind.volRatio >= 1.1, `${ind.volRatio.toFixed(2)}× average`);

  const atrPct = (ind.atr / ind.price) * 100;
  add('volatility', 'Volatility & fees', atrPct >= 0.15 && atrPct <= 3 && takeProfitPercent >= ROUND_TRIP_FEE_PCT * 3,
    `ATR ${pct(atrPct)}, TP ${takeProfitPercent}% vs fees ${ROUND_TRIP_FEE_PCT}%`);

  const stretch = Math.abs(ind.price - ind.ema20) / ind.atr;
  const wrongSide = L ? ind.price < ind.ema20 - ind.atr * 2 : ind.price > ind.ema20 + ind.atr * 2;
  add('notExtended', 'Not chasing', stretch <= 1.5 && !wrongSide, `${stretch.toFixed(2)} ATR from EMA20`);

  const btcCloses = btcH1Closes || h1Closes;
  const btcUp = emaTrendUp(btcCloses);
  const btcOk = btcUp === null ? null : (L ? btcUp && (btc24h ?? 0) > -3 : !btcUp && (btc24h ?? 0) < 3);
  add('market', 'BTC market health', btcOk,
    btcUp === null ? 'no BTC data' : `BTC 1h ${btcUp ? 'up' : 'down'}, 24h ${pct(btc24h ?? 0)}`, btcUp === null);

  if (!sentiment) add('sentiment', 'AI / news sentiment', true, 'AI filter off', true);
  else {
    const against = L ? 'bearish' : 'bullish';
    add('sentiment', 'AI / news sentiment', !(sentiment.sentiment === against && sentiment.confidence >= 60),
      `${sentiment.sentiment} ${sentiment.confidence}%`);
  }

  const passed = checks.filter(c => c.pass).length;
  return { checks, passed, total: checks.length, ok: passed >= minPass };
}

/** One-line summary for bot logs, e.g. "8/10 ✗ Volume (0.84× average) ✗ Not chasing (2.10 ATR…)". */
export function checklistSummary(res) {
  const failed = res.checks.filter(c => !c.pass).map(c => `✗ ${c.name} (${c.detail})`);
  const skipped = res.checks.filter(c => c.skipped).length;
  return `${res.passed}/${res.total}${skipped ? ` (${skipped} skipped)` : ''}${failed.length ? ' ' + failed.join(' ') : ' ✓ all clear'}`;
}
