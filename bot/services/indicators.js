import { RSI, MACD, EMA } from 'technicalindicators';

export function calculateIndicators(candles) {
  if (candles.length < 60) throw new Error('Need at least 60 candles');

  const closes  = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const rsi  = RSI.calculate({ values: closes, period: 14 });
  const macd = MACD.calculate({
    values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
    SimpleMAOscillator: false, SimpleMASignal: false,
  });
  const ema20 = EMA.calculate({ values: closes, period: 20 });
  const ema50 = EMA.calculate({ values: closes, period: 50 });

  const curr = macd.at(-1);
  const prev = macd.at(-2);

  const macdLine     = curr?.MACD    ?? 0;
  const signalLine   = curr?.signal  ?? 0;
  const prevMacd     = prev?.MACD    ?? 0;
  const prevSignal   = prev?.signal  ?? 0;
  const bullishCross = prevMacd < prevSignal && macdLine > signalLine;
  const bearishCross = prevMacd > prevSignal && macdLine < signalLine;

  const avgVol = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;

  return {
    rsi:              parseFloat(rsi.at(-1)?.toFixed(2)),
    macdHistogram:    parseFloat((macdLine - signalLine).toFixed(6)),
    bullishCrossover: bullishCross,
    bearishCrossover: bearishCross,
    ema20:            parseFloat(ema20.at(-1)?.toFixed(4)),
    ema50:            parseFloat(ema50.at(-1)?.toFixed(4)),
    uptrend:          ema20.at(-1) > ema50.at(-1),
    volumeIncreasing: volumes.at(-1) > avgVol * 1.2,
    currentPrice:     closes.at(-1),
  };
}

export function detectSignal({ rsi, bullishCrossover, bearishCrossover, uptrend, volumeIncreasing }, aggressive = false) {
  if (aggressive) {
    // Aggressive: buy when RSI < 65 (fires very frequently)
    const buy  = rsi < 65;
    const sell = rsi > 75 || bearishCrossover;
    return buy ? 'BUY' : sell ? 'SELL' : 'HOLD';
  }

  // Normal: buy when RSI < 40 (moderate — avoids extreme overbought entries)
  const buy  = rsi < 40;
  const sell = rsi > 70 || bearishCrossover;

  return buy ? 'BUY' : sell ? 'SELL' : 'HOLD';
}
