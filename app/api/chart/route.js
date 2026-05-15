import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol   = searchParams.get('symbol')   || 'BTCUSDT';
  const interval = searchParams.get('interval') || '5m';
  const limit    = parseInt(searchParams.get('limit') || '200');

  const { data } = await axios.get('https://api.binance.com/api/v3/klines', {
    params: { symbol, interval, limit },
    timeout: 8000,
  });

  const candles = data.map(c => ({
    timestamp: c[0],                  // raw ms — for lightweight-charts (divide by 1000)
    open:      parseFloat(c[1]),
    high:      parseFloat(c[2]),
    low:       parseFloat(c[3]),
    close:     parseFloat(c[4]),
    volume:    parseFloat(c[5]),
  }));

  const closes    = candles.map(c => c.close);
  const rsiValues = calcRSI(closes, 14);

  const result = candles.map((c, i) => ({
    ...c,
    rsi: rsiValues[i] !== null ? parseFloat(rsiValues[i].toFixed(2)) : null,
  }));

  return NextResponse.json(result);
}

function calcRSI(closes, period = 14) {
  const rsi = new Array(closes.length).fill(null);
  if (closes.length <= period) return rsi;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}
