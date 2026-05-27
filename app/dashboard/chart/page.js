'use client';
import { useEffect, useRef, useState } from 'react';
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  CandlestickSeries, HistogramSeries, LineSeries,
} from 'lightweight-charts';
import { RefreshCw, BarChart2, Wifi, WifiOff, ArrowUp, ArrowDown, Activity } from 'lucide-react';
import SymbolSearch from '@/components/SymbolSearch';

const INTERVALS = ['1m', '5m', '15m', '1h', '4h'];

function calcRSI(closes, period = 14) {
  const rsi = new Array(closes.length).fill(null);
  if (closes.length <= period) return rsi;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

const BASE_OPTS = {
  layout: {
    background: { type: ColorType.Solid, color: '#ffffff' },
    textColor: '#64748b',
    fontFamily: "'Open Sans', sans-serif",
    fontSize: 11,
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: '#f1f5f9' },
    horzLines: { color: '#f1f5f9' },
  },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: '#e2e8f0' },
  timeScale: { borderColor: '#e2e8f0', timeVisible: true, secondsVisible: false },
};

export default function ChartPage() {
  const mainRef  = useRef(null);
  const rsiRef   = useRef(null);
  const chartRef       = useRef(null);
  const rsiChartRef    = useRef(null);
  const candleSerRef   = useRef(null);
  const volumeSerRef   = useRef(null);
  const rsiSerRef      = useRef(null);
  const wsRef          = useRef(null);
  const wsRetryRef     = useRef(null);
  const wsActiveRef    = useRef(true);

  const [symbol,    setSymbol]    = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('5m');
  const [loading,   setLoading]   = useState(true);
  const [wsOk,      setWsOk]      = useState(false);
  const [price,     setPrice]     = useState(null);
  const [change24,  setChange24]  = useState(null);
  const [rsiNow,    setRsiNow]    = useState(null);
  const [ohlc,      setOhlc]      = useState(null);

  // ── Create charts once on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!mainRef.current || !rsiRef.current) return;

    // Main chart — shorter on small screens
    const isMobile = window.innerWidth < 640;
    const chart = createChart(mainRef.current, {
      ...BASE_OPTS,
      width:  mainRef.current.clientWidth,
      height: isMobile ? 260 : 380,
    });

    const candleSer = chart.addSeries(CandlestickSeries, {
      upColor:         '#16a34a',
      downColor:       '#ef4444',
      borderUpColor:   '#16a34a',
      borderDownColor: '#ef4444',
      wickUpColor:     '#16a34a',
      wickDownColor:   '#ef4444',
    });

    const volumeSer = chart.addSeries(HistogramSeries, {
      color:        '#2563eb',
      priceFormat:  { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    // RSI chart
    const rsiChart = createChart(rsiRef.current, {
      ...BASE_OPTS,
      width:  rsiRef.current.clientWidth,
      height: 130,
    });
    rsiChart.priceScale('right').applyOptions({
      minimum: 0, maximum: 100,
      scaleMargins: { top: 0.05, bottom: 0.05 },
    });

    const rsiSer = rsiChart.addSeries(LineSeries, {
      color:       '#7c3aed',
      lineWidth:   2,
      priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
    });

    // RSI reference lines via price lines on the series
    [
      { price: 70, color: '#ef4444', label: '70' },
      { price: 60, color: '#2563eb', label: '60' },
      { price: 30, color: '#16a34a', label: '30' },
    ].forEach(({ price: p, color, label }) => {
      rsiSer.createPriceLine({
        price: p, color, lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: label,
      });
    });

    chartRef.current     = chart;
    rsiChartRef.current  = rsiChart;
    candleSerRef.current = candleSer;
    volumeSerRef.current = volumeSer;
    rsiSerRef.current    = rsiSer;

    // Sync scrolling between charts
    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range) rsiChart.timeScale().setVisibleLogicalRange(range);
    });
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range) chart.timeScale().setVisibleLogicalRange(range);
    });

    const onResize = () => {
      const mobile = window.innerWidth < 640;
      if (mainRef.current) chart.applyOptions({ width: mainRef.current.clientWidth, height: mobile ? 260 : 380 });
      if (rsiRef.current)  rsiChart.applyOptions({ width: rsiRef.current.clientWidth, height: mobile ? 100 : 130 });
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      rsiChart.remove();
    };
  }, []);

  // ── Reload history + reconnect WS when symbol / timeframe changes ────────────
  useEffect(() => {
    wsActiveRef.current = true;
    loadHistory();
    connectWS();
    return () => {
      wsActiveRef.current = false;
      clearTimeout(wsRetryRef.current);
      wsRef.current?.close();
    };
  }, [symbol, timeframe]); // eslint-disable-line

  async function loadHistory() {
    setLoading(true);
    try {
      // Fetch directly from Binance (supports CORS) — avoids server geo-blocks
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=200`
      );
      if (!res.ok) throw new Error(`Binance ${res.status}`);
      const raw = await res.json();
      if (!raw.length) return;

      const parsed = raw.map(c => ({
        timestamp: c[0],
        open:   parseFloat(c[1]),
        high:   parseFloat(c[2]),
        low:    parseFloat(c[3]),
        close:  parseFloat(c[4]),
        volume: parseFloat(c[5]),
      }));

      const closes    = parsed.map(c => c.close);
      const rsiValues = calcRSI(closes, 14);
      const data = parsed.map((c, i) => ({
        ...c,
        rsi: rsiValues[i] !== null ? parseFloat(rsiValues[i].toFixed(2)) : null,
      }));

      // Offset timestamps to user's local timezone so chart shows local time
      const tzOffset = -new Date().getTimezoneOffset() * 60;
      const candles = data.map(c => ({
        time:  Math.floor(c.timestamp / 1000) + tzOffset,
        open:  c.open, high: c.high, low: c.low, close: c.close,
      }));
      const volumes = data.map(c => ({
        time:  Math.floor(c.timestamp / 1000) + tzOffset,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(22,163,74,0.35)' : 'rgba(239,68,68,0.35)',
      }));
      const rsiData = data
        .filter(c => c.rsi !== null)
        .map(c => ({ time: Math.floor(c.timestamp / 1000) + tzOffset, value: c.rsi }));

      candleSerRef.current?.setData(candles);
      volumeSerRef.current?.setData(volumes);
      rsiSerRef.current?.setData(rsiData);
      chartRef.current?.timeScale().scrollToRealTime();

      const last  = data[data.length - 1];
      const first = data[0];
      setPrice(last.close);
      setChange24(((last.close - first.close) / first.close * 100).toFixed(2));
      setRsiNow(last.rsi);
      setOhlc({ o: last.open, h: last.high, l: last.low, c: last.close });
    } finally {
      setLoading(false);
    }
  }

  function connectWS() {
    wsRef.current?.close();
    clearTimeout(wsRetryRef.current);
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${timeframe}`
    );
    ws.onopen  = () => setWsOk(true);
    ws.onclose = () => {
      setWsOk(false);
      if (wsActiveRef.current) {
        wsRetryRef.current = setTimeout(connectWS, 5000);
      }
    };
    ws.onerror = () => { ws.close(); };
    ws.onmessage = (e) => {
      const { k } = JSON.parse(e.data);
      const tzOffset = -new Date().getTimezoneOffset() * 60;
      const t = Math.floor(k.t / 1000) + tzOffset;
      const o = parseFloat(k.o), h = parseFloat(k.h),
            l = parseFloat(k.l), c = parseFloat(k.c);
      const v = parseFloat(k.v);

      candleSerRef.current?.update({ time: t, open: o, high: h, low: l, close: c });
      volumeSerRef.current?.update({
        time: t, value: v,
        color: c >= o ? 'rgba(22,163,74,0.35)' : 'rgba(239,68,68,0.35)',
      });

      setPrice(c);
      setOhlc({ o, h, l, c });
    };
    wsRef.current = ws;
  }

  const priceUp  = parseFloat(change24) >= 0;
  const rsiColor = !rsiNow ? '#94a3b8'
    : rsiNow < 35 ? '#16a34a'
    : rsiNow > 70 ? '#dc2626'
    : rsiNow < 60 ? '#2563eb'
    : '#94a3b8';
  const rsiLabel = !rsiNow ? '—'
    : rsiNow < 35 ? 'Oversold'
    : rsiNow > 70 ? 'Overbought'
    : rsiNow < 60 ? 'Buy zone'
    : 'Neutral';

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart2 size={20} className="text-blue-500" />
          Live Chart
        </h1>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border"
            style={{
              background:   wsOk ? '#f0fdf4' : '#fef2f2',
              color:        wsOk ? '#16a34a' : '#dc2626',
              borderColor:  wsOk ? '#bbf7d0' : '#fecaca',
            }}>
            {wsOk ? <Wifi size={11} /> : <WifiOff size={11} />}
            {wsOk ? 'Live' : '...'}
          </span>
          <button onClick={loadHistory}
            className="btn-outline py-1.5 px-2.5 flex items-center gap-1 text-xs">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Reload</span>
          </button>
        </div>
      </div>

      {/* Symbol + Interval selectors */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SymbolSearch value={symbol} onChange={setSymbol} size="sm" />
        <div className="flex gap-0.5 bg-slate-100 p-1 rounded-lg">
          {INTERVALS.map(iv => (
            <button key={iv} onClick={() => setTimeframe(iv)}
              className="px-2.5 py-1.5 rounded-md text-xs font-bold transition-all"
              style={{
                background: timeframe === iv ? 'white' : 'transparent',
                color:      timeframe === iv ? '#0f172a' : '#64748b',
                boxShadow:  timeframe === iv ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
              {iv}
            </button>
          ))}
        </div>
      </div>

      {/* Price ticker */}
      <div className="card glow-border mb-4 px-5 py-3 flex flex-wrap items-center gap-6">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">{symbol}</div>
          <div className="text-2xl font-bold text-slate-900">
            {price
              ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </div>
        </div>

        {change24 !== null && (
          <div className={`flex items-center gap-1 text-sm font-bold ${priceUp ? 'text-emerald-600' : 'text-red-500'}`}>
            {priceUp ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            {priceUp ? '+' : ''}{change24}%
          </div>
        )}

        {ohlc && (
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>O <span className="font-mono text-slate-700">{ohlc.o?.toFixed(2)}</span></span>
            <span>H <span className="font-mono text-emerald-600">{ohlc.h?.toFixed(2)}</span></span>
            <span>L <span className="font-mono text-red-500">{ohlc.l?.toFixed(2)}</span></span>
            <span>C <span className="font-mono font-bold text-slate-900">{ohlc.c?.toFixed(2)}</span></span>
          </div>
        )}

        {rsiNow !== null && (
          <div className="flex items-center gap-2 ml-auto">
            <Activity size={13} className="text-slate-400" />
            <span className="text-xs text-slate-500">RSI-14</span>
            <span className="font-bold text-sm" style={{ color: rsiColor }}>{rsiNow}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold border"
              style={{ background: rsiColor + '18', color: rsiColor, borderColor: rsiColor + '40' }}>
              {rsiLabel}
            </span>
          </div>
        )}
      </div>

      {/* Chart card */}
      <div className="card glow-border overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <RefreshCw size={24} className="text-blue-500 animate-spin" />
          </div>
        )}

        <div className="px-2 pt-3 pb-0">
          <div className="text-xs font-semibold text-slate-500 px-3 mb-2">
            {symbol} &middot; {timeframe} &middot; Candlestick + Volume
          </div>
          <div ref={mainRef} />
        </div>

        <div className="px-2 pb-3 border-t border-slate-100 mt-1">
          <div className="text-xs font-semibold text-slate-500 px-3 mt-2 mb-1">
            RSI (14) &middot; Buy &lt;60 &middot; Sell &gt;70
          </div>
          <div ref={rsiRef} />
        </div>
      </div>
    </div>
  );
}
