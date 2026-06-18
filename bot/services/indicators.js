import { RSI, MACD, EMA } from 'technicalindicators';

export function calculateIndicators(candles) {
  if (candles.length < 100) throw new Error('Need at least 100 candles');

  const closes  = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const rsi   = RSI.calculate({ values: closes, period: 14 });
  const macd  = MACD.calculate({
    values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
    SimpleMAOscillator: false, SimpleMASignal: false,
  });
  const ema20  = EMA.calculate({ values: closes, period: 20 });
  const ema50  = EMA.calculate({ values: closes, period: 50 });
  const ema100 = EMA.calculate({ values: closes, period: 100 });

  const curr = macd.at(-1);
  const prev = macd.at(-2);

  const macdLine   = curr?.MACD   ?? 0;
  const signalLine = curr?.signal ?? 0;
  const prevMacd   = prev?.MACD   ?? 0;
  const prevSignal = prev?.signal ?? 0;

  const bullishCross = prevMacd < prevSignal && macdLine > signalLine;
  const bearishCross = prevMacd > prevSignal && macdLine < signalLine;

  const avgVol     = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const price      = closes.at(-1);
  const e100       = ema100.at(-1);

  return {
    rsi:              parseFloat(rsi.at(-1)?.toFixed(2)),
    macdHistogram:    parseFloat((macdLine - signalLine).toFixed(6)),
    bullishCrossover: bullishCross,
    bearishCrossover: bearishCross,
    ema20:            parseFloat(ema20.at(-1)?.toFixed(4)),
    ema50:            parseFloat(ema50.at(-1)?.toFixed(4)),
    ema100:           parseFloat(e100?.toFixed(4)),
    uptrend:          ema20.at(-1) > ema50.at(-1),       // local trend
    macroUptrend:     price > e100,                       // macro trend: price above EMA100
    volumeIncreasing: volumes.at(-1) > avgVol * 1.2,
    currentPrice:     price,
  };
}

export function detectSignal(
  { rsi, bullishCrossover, bearishCrossover, uptrend, macroUptrend, volumeIncreasing },
  aggressive = false
) {
  // SELL is always evaluated regardless of trend
  const sell = rsi > 70 || bearishCrossover;

  // ── Macro bear gate ───────────────────────────────────────────────────────
  // Price is below EMA100 → macro downtrend → block ALL new buys
  if (!macroUptrend) {
    return sell ? 'SELL' : 'HOLD';
  }

  // ── Aggressive mode ───────────────────────────────────────────────────────
  if (aggressive) {
    // Requires local uptrend + volume confirmation (was: RSI < 65 blindly)
    const buy     = rsi < 55 && uptrend && volumeIncreasing;
    const agSell  = rsi > 72 || bearishCrossover;
    return buy ? 'BUY' : agSell ? 'SELL' : 'HOLD';
  }

  // ── Normal mode ───────────────────────────────────────────────────────────
  // In a confirmed local uptrend, buy dips up to RSI 48 (more frequent)
  // In a local pullback within the macro bull, require deeper oversold (RSI 40)
  const rsiThreshold = uptrend ? 48 : 40;
  const buy = rsi < rsiThreshold && uptrend && !bearishCrossover;

  return buy ? 'BUY' : sell ? 'SELL' : 'HOLD';
}
