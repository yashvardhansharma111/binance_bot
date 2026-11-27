'use client';
import { useEffect, useRef, useState } from 'react';
import {
  createChart, ColorType, CrosshairMode, LineStyle, createSeriesMarkers,
  CandlestickSeries, HistogramSeries, LineSeries,
} from 'lightweight-charts';
import {
  RefreshCw, BarChart2, Wifi, WifiOff, ArrowUp, ArrowDown, Activity, Bot, Bell, BellRing,
  Crosshair, X, CheckCircle2, XCircle, MinusCircle, Brain,
} from 'lucide-react';
import SymbolSearch from '@/components/SymbolSearch';
import { useTheme } from '@/app/ThemeContext';

const INTERVALS = ['1m', '5m', '15m', '1h', '4h'];
const IV_MS = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '1h': 3600e3, '4h': 14400e3 };
const EMA_COLORS = { 20: '#f59e0b', 50: '#38bdf8', 100: '#a78bfa' };

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

function calcEMA(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = e;
  for (let i = period; i < values.length; i++) { e = values[i] * k + e * (1 - k); out[i] = e; }
  return out;
}

/** Price with sensible decimals for any coin (BTC 60,000 → 2; PEPE 0.0000123 → 8). */
function fmt(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  const d = p >= 1000 ? 2 : p >= 1 ? 4 : p >= 0.01 ? 6 : 8;
  return p.toLocaleString(undefined, { minimumFractionDigits: Math.min(d, 2), maximumFractionDigits: d });
}
const money = (n) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* lightweight-charts paints to canvas, so it can't inherit the CSS theme —
   its palette has to be passed in explicitly and re-applied on theme change. */
const CHART_THEME = {
  dark: {
    bg: '#09090f', text: '#6b8299', grid: 'rgba(255,255,255,0.055)', border: 'rgba(255,255,255,0.09)',
    up: '#10b981', down: '#f43f5e', volume: 'rgba(16,185,129,0.35)', rsi: '#a78bfa',
    overbought: '#f43f5e', mid: '#38bdf8', oversold: '#10b981',
  },
  light: {
    bg: '#ffffff', text: '#64748b', grid: '#f1f5f9', border: '#e2e8f0',
    up: '#16a34a', down: '#ef4444', volume: '#2563eb', rsi: '#7c3aed',
    overbought: '#ef4444', mid: '#2563eb', oversold: '#16a34a',
  },
};

const chartOpts = (t) => ({
  layout: {
    background: { type: ColorType.Solid, color: t.bg },
    textColor: t.text, fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11, attributionLogo: false,
  },
  grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: t.border },
  timeScale: { borderColor: t.border, timeVisible: true, secondsVisible: false },
  autoSize: true,
});

const tzOffset = () => -new Date().getTimezoneOffset() * 60;

function Toggle({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold transition-all"
      style={{ background: on ? 'var(--accent-dim)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-3)',
        boxShadow: on ? 'inset 0 0 0 1px var(--border-hover)' : 'none' }}>
      {children}
    </button>
  );
}

export default function ChartPage() {
  const { theme }      = useTheme();
  const themeRef       = useRef(theme);
  const mainRef        = useRef(null);
  const rsiRef         = useRef(null);
  const chartRef       = useRef(null);
  const rsiChartRef    = useRef(null);
  const candleSerRef   = useRef(null);
  const volumeSerRef   = useRef(null);
  const rsiSerRef      = useRef(null);
  const emaSerRef      = useRef({});
  const markersRef     = useRef(null);
  const linesRef       = useRef([]);
  const candlesRef     = useRef([]);   // parsed candles (ms timestamps) for EMA + marker placement
  const ctxRef         = useRef(null);
  const alertsRef      = useRef([]);
  const wsRef          = useRef(null);
  const wsRetryRef     = useRef(null);
  const wsActiveRef    = useRef(false);
  const syncingRef     = useRef(false);

  const [symbol,    setSymbol]    = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('5m');
  const [market,    setMarket]    = useState('spot');
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');
  const [wsOk,      setWsOk]      = useState(false);
  const [price,     setPrice]     = useState(null);
  const [change24,  setChange24]  = useState(null);
  const [rsiNow,    setRsiNow]    = useState(null);
  const [ohlc,      setOhlc]      = useState(null);
  const [showEma,   setShowEma]   = useState(true);
  const [showTrades, setShowTrades] = useState(true);
  const [ctx,       setCtx]       = useState(null);
  const [alerts,    setAlerts]    = useState({ active: [], triggered: [] });
  const [alertPrice, setAlertPrice] = useState('');
  const [alertNote, setAlertNote] = useState('');
  const [alertMsg,  setAlertMsg]  = useState('');
  const [now,       setNow]       = useState(Date.now());
  const showRef = useRef({ ema: true, trades: true });

  // ── Create charts once on mount ────────────────────────────────────────
  useEffect(() => {
    if (!mainRef.current || !rsiRef.current) return;
    const isMobile = window.innerWidth < 640;
    const t = CHART_THEME[themeRef.current] ?? CHART_THEME.dark;

    const chart = createChart(mainRef.current, { ...chartOpts(t), height: isMobile ? 300 : 420 });
    const candleSer = chart.addSeries(CandlestickSeries, {
      upColor: t.up, downColor: t.down, borderUpColor: t.up, borderDownColor: t.down, wickUpColor: t.up, wickDownColor: t.down,
    });
    const volumeSer = chart.addSeries(HistogramSeries, { color: t.volume, priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    const emas = {};
    for (const p of [20, 50, 100]) {
      emas[p] = chart.addSeries(LineSeries, {
        color: EMA_COLORS[p], lineWidth: p === 20 ? 1 : 2, priceLineVisible: false, lastValueVisible: false,
        crosshairMarkerVisible: false, title: `EMA${p}`,
      });
    }

    const rsiChart = createChart(rsiRef.current, { ...chartOpts(t), height: isMobile ? 100 : 130 });
    rsiChart.priceScale('right').applyOptions({ minimum: 0, maximum: 100, scaleMargins: { top: 0.05, bottom: 0.05 } });
    const rsiSer = rsiChart.addSeries(LineSeries, { color: t.rsi, lineWidth: 2, priceFormat: { type: 'price', precision: 1, minMove: 0.1 } });
    [{ price: 70, color: t.overbought, label: '70' }, { price: 60, color: t.mid, label: '60' }, { price: 30, color: t.oversold, label: '30' }]
      .forEach(({ price: p, color, label }) => rsiSer.createPriceLine({ price: p, color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: label }));

    chartRef.current = chart; rsiChartRef.current = rsiChart;
    candleSerRef.current = candleSer; volumeSerRef.current = volumeSer; rsiSerRef.current = rsiSer;
    emaSerRef.current = emas;
    markersRef.current = createSeriesMarkers(candleSer, []);

    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (syncingRef.current || !range) return;
      syncingRef.current = true; rsiChart.timeScale().setVisibleLogicalRange(range); syncingRef.current = false;
    });
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (syncingRef.current || !range) return;
      syncingRef.current = true; chart.timeScale().setVisibleLogicalRange(range); syncingRef.current = false;
    });

    return () => {
      chart.remove(); rsiChart.remove();
      chartRef.current = null; rsiChartRef.current = null; candleSerRef.current = null;
      volumeSerRef.current = null; rsiSerRef.current = null; emaSerRef.current = {}; markersRef.current = null; linesRef.current = [];
    };
  }, []);

  // ── Repaint the canvas palette when the theme toggles ──────────────────
  useEffect(() => {
    themeRef.current = theme;
    const t = CHART_THEME[theme] ?? CHART_THEME.dark;
    const opts = chartOpts(t);
    chartRef.current?.applyOptions(opts);
    rsiChartRef.current?.applyOptions(opts);
    candleSerRef.current?.applyOptions({ upColor: t.up, downColor: t.down, borderUpColor: t.up, borderDownColor: t.down, wickUpColor: t.up, wickDownColor: t.down });
    volumeSerRef.current?.applyOptions({ color: t.volume });
    rsiSerRef.current?.applyOptions({ color: t.rsi });
  }, [theme]);

  // ── Reload history + reconnect WS + overlays when the chart changes ────
  useEffect(() => {
    wsActiveRef.current = true;
    setCtx(null); ctxRef.current = null;
    loadHistory().then(() => { loadContext(); loadAlerts(); });
    connectWS();
    const iv = setInterval(() => { loadContext(); loadAlerts(); }, 30_000);
    return () => {
      clearInterval(iv);
      wsActiveRef.current = false;
      clearTimeout(wsRetryRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
      setWsOk(false);
    };
  }, [symbol, timeframe, market]); // eslint-disable-line

  // Toggles + 1s clock for the funding countdown.
  useEffect(() => {
    showRef.current = { ema: showEma, trades: showTrades };
    for (const s of Object.values(emaSerRef.current)) s?.applyOptions({ visible: showEma });
    applyOverlays();
  }, [showEma, showTrades]); // eslint-disable-line
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  const toTime = (ms) => {
    const step = IV_MS[timeframe];
    return Math.floor((Math.floor(ms / step) * step) / 1000) + tzOffset();
  };

  async function loadHistory() {
    if (!candleSerRef.current) return;
    setLoading(true); setLoadError('');
    try {
      const url = market === 'futures'
        ? `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=300`
        : `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=300`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status === 400 ? `${symbol} is not available on Binance ${market}` : `Binance ${res.status}`);
      const raw = await res.json();
      if (!raw.length) return;
      const parsed = raw.map(c => ({ timestamp: c[0], open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +c[5] }));
      candlesRef.current = parsed;
      const closes = parsed.map(c => c.close);
      const rsiValues = calcRSI(closes, 14);
      const off = tzOffset();
      const time = (c) => Math.floor(c.timestamp / 1000) + off;
      if (!candleSerRef.current) return;

      candleSerRef.current.setData(parsed.map(c => ({ time: time(c), open: c.open, high: c.high, low: c.low, close: c.close })));
      volumeSerRef.current.setData(parsed.map(c => ({ time: time(c), value: c.volume, color: c.close >= c.open ? 'rgba(22,163,74,0.35)' : 'rgba(239,68,68,0.35)' })));
      rsiSerRef.current.setData(parsed.map((c, i) => ({ time: time(c), value: rsiValues[i] })).filter(d => d.value !== null));
      for (const p of [20, 50, 100]) {
        const e = calcEMA(closes, p);
        emaSerRef.current[p]?.setData(parsed.map((c, i) => ({ time: time(c), value: e[i] })).filter(d => d.value !== null));
        emaSerRef.current[p]?.applyOptions({ visible: showRef.current.ema });
      }
      chartRef.current?.timeScale().scrollToRealTime();

      const last = parsed[parsed.length - 1], first = parsed[0], lastRsi = rsiValues[rsiValues.length - 1];
      setPrice(last.close);
      setChange24(((last.close - first.close) / first.close * 100).toFixed(2));
      setRsiNow(lastRsi !== null ? parseFloat(lastRsi.toFixed(2)) : null);
      setOhlc({ o: last.open, h: last.high, l: last.low, c: last.close });
      applyOverlays();
    } catch (e) {
      setLoadError(e.message);
      candleSerRef.current?.setData([]); volumeSerRef.current?.setData([]); rsiSerRef.current?.setData([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadContext() {
    try {
      const r = await fetch(`/api/chart/context?symbol=${symbol}&market=${market}`);
      if (!r.ok) return;
      const d = await r.json();
      ctxRef.current = d; setCtx(d);
      applyOverlays();
    } catch { /* overlays are optional */ }
  }

  async function loadAlerts() {
    try {
      const r = await fetch(`/api/alerts?symbol=${symbol}&market=${market}`);
      if (!r.ok) return;
      const d = await r.json();
      alertsRef.current = d.active || [];
      setAlerts({ active: d.active || [], triggered: d.triggered || [] });
      applyOverlays();
    } catch { /* ignore */ }
  }

  /** Trade markers + position / alert price lines on the candle series. */
  function applyOverlays() {
    const ser = candleSerRef.current;
    if (!ser) return;
    for (const l of linesRef.current) { try { ser.removePriceLine(l); } catch { /* already gone */ } }
    linesRef.current = [];
    const add = (price, color, title, style = LineStyle.Dashed, width = 1) => {
      if (!price) return;
      linesRef.current.push(ser.createPriceLine({ price, color, lineWidth: width, lineStyle: style, axisLabelVisible: true, title }));
    };

    const c = ctxRef.current;
    const firstMs = candlesRef.current[0]?.timestamp ?? Infinity;
    const markers = [];
    if (c && showRef.current.trades) {
      for (const t of c.trades) {
        const openMs = new Date(t.openedAt).getTime();
        const short = t.side === 'SHORT';
        const label = t.side === 'BUY' ? 'BUY' : `${t.side}${t.leverage ? ` ${t.leverage}x` : ''}`;
        if (openMs >= firstMs) markers.push({
          time: toTime(openMs), position: short ? 'aboveBar' : 'belowBar', shape: short ? 'arrowDown' : 'arrowUp',
          color: short ? '#ef4444' : '#16a34a', text: `${label}${t.source === 'manual' ? ' (manual)' : ''}`,
        });
        if (t.status === 'closed' && t.closedAt && new Date(t.closedAt).getTime() >= firstMs) markers.push({
          time: toTime(new Date(t.closedAt).getTime()), position: short ? 'belowBar' : 'aboveBar', shape: 'circle',
          color: (t.profit || 0) >= 0 ? '#16a34a' : '#ef4444', text: money(t.profit || 0),
        });
      }
      for (const p of c.positions) {
        add(p.entry, '#3b82f6', `${p.side === 'BUY' ? 'Entry' : p.side} entry`, LineStyle.Solid, 2);
        add(p.stopLoss, '#ef4444', 'SL');
        add(p.takeProfit, '#16a34a', 'TP');
        add(p.liquidationPrice, '#f97316', 'Liq', LineStyle.Dotted, 2);
      }
    }
    for (const a of alertsRef.current) add(a.price, '#a855f7', `🔔 ${a.condition === 'above' ? '≥' : '≤'}`, LineStyle.Dotted);
    markers.sort((a, b) => a.time - b.time);
    markersRef.current?.setMarkers(markers);
  }

  function connectWS() {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    clearTimeout(wsRetryRef.current);
    const base = market === 'futures' ? 'wss://fstream.binance.com/ws' : 'wss://stream.binance.com:9443/ws';
    const ws = new WebSocket(`${base}/${symbol.toLowerCase()}@kline_${timeframe}`);
    ws.onopen = () => { if (wsActiveRef.current) setWsOk(true); };
    ws.onclose = () => { setWsOk(false); if (wsActiveRef.current) wsRetryRef.current = setTimeout(connectWS, 5000); };
    ws.onerror = () => { ws.close(); };
    ws.onmessage = (e) => {
      if (!wsActiveRef.current || !candleSerRef.current) return;
      const { k } = JSON.parse(e.data);
      const t = Math.floor(k.t / 1000) + tzOffset();
      const o = +k.o, h = +k.h, l = +k.l, c = +k.c, v = +k.v;
      candleSerRef.current?.update({ time: t, open: o, high: h, low: l, close: c });
      volumeSerRef.current?.update({ time: t, value: v, color: c >= o ? 'rgba(22,163,74,0.35)' : 'rgba(239,68,68,0.35)' });
      setPrice(c); setOhlc({ o, h, l, c });
    };
    wsRef.current = ws;
  }

  async function addAlert() {
    setAlertMsg('');
    const r = await fetch('/api/alerts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, market, price: parseFloat(alertPrice), note: alertNote }),
    });
    const d = await r.json();
    if (!r.ok) { setAlertMsg(`✗ ${d.error}`); return; }
    setAlertMsg(`✓ Alert set — you'll be notified when ${symbol} ${d.alert.condition === 'above' ? 'rises to' : 'falls to'} ${fmt(d.alert.price)}`);
    setAlertPrice(''); setAlertNote('');
    loadAlerts();
  }
  async function removeAlert(id) {
    await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' });
    loadAlerts();
  }

  const priceUp  = parseFloat(change24) >= 0;
  const rsiColor = !rsiNow ? '#94a3b8' : rsiNow < 35 ? '#16a34a' : rsiNow > 70 ? '#dc2626' : rsiNow < 60 ? '#2563eb' : '#94a3b8';
  const rsiLabel = !rsiNow ? '—' : rsiNow < 35 ? 'Oversold' : rsiNow > 70 ? 'Overbought' : rsiNow < 60 ? 'Buy zone' : 'Neutral';
  const bot = ctx?.bot;
  const fut = ctx?.futures;
  const fundingLeft = fut?.nextFundingTime ? Math.max(0, fut.nextFundingTime - now) : null;
  const hms = (ms) => [3600e3, 60e3, 1e3].map(u => String(Math.floor(ms / u) % (u === 3600e3 ? 100 : 60)).padStart(2, '0')).join(':');
  const sigColor = bot?.signal === 'BUY' ? '#16a34a' : bot?.signal === 'SELL' ? '#ef4444' : '#94a3b8';

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart2 size={20} className="text-blue-500" /> Live Chart
        </h1>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border"
            style={{ background: wsOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: wsOk ? 'var(--success)' : 'var(--danger)',
              borderColor: wsOk ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
            {wsOk ? <Wifi size={11} /> : <WifiOff size={11} />}{wsOk ? 'Live' : '...'}
          </span>
          <button onClick={() => { loadHistory(); loadContext(); loadAlerts(); }} className="btn-outline py-1.5 px-2.5 flex items-center gap-1 text-xs">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /><span className="hidden sm:inline">Reload</span>
          </button>
        </div>
      </div>

      {/* Symbol + market + interval + overlays */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SymbolSearch value={symbol} onChange={setSymbol} size="sm" />
        <div className="flex gap-0.5 rounded-lg p-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          {['spot', 'futures'].map(m => <Toggle key={m} on={market === m} onClick={() => setMarket(m)}>{m === 'spot' ? 'Spot' : 'Futures'}</Toggle>)}
        </div>
        <div className="flex gap-0.5 rounded-lg p-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          {INTERVALS.map(iv => <Toggle key={iv} on={timeframe === iv} onClick={() => setTimeframe(iv)}>{iv}</Toggle>)}
        </div>
        <div className="flex gap-0.5 rounded-lg p-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <Toggle on={showEma} onClick={() => setShowEma(v => !v)}>EMA</Toggle>
          <Toggle on={showTrades} onClick={() => setShowTrades(v => !v)}><Crosshair size={11} /> My trades</Toggle>
        </div>
      </div>

      {/* Price ticker */}
      <div className="card glow-border mb-4 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">{symbol} · {market === 'futures' ? 'USDⓈ-M perpetual' : 'Spot'}</div>
          <div className="text-2xl font-bold text-slate-900">{price ? `$${fmt(price)}` : '—'}</div>
        </div>
        {change24 !== null && (
          <div className={`flex items-center gap-1 text-sm font-bold ${priceUp ? 'text-emerald-600' : 'text-red-500'}`}>
            {priceUp ? <ArrowUp size={14} /> : <ArrowDown size={14} />}{priceUp ? '+' : ''}{change24}%
          </div>
        )}
        {ohlc && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>O <span className="font-mono text-slate-700">{fmt(ohlc.o)}</span></span>
            <span>H <span className="font-mono text-emerald-600">{fmt(ohlc.h)}</span></span>
            <span>L <span className="font-mono text-red-500">{fmt(ohlc.l)}</span></span>
            <span>C <span className="font-mono font-bold text-slate-900">{fmt(ohlc.c)}</span></span>
          </div>
        )}
        {market === 'futures' && fut && !fut.error && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>Mark <span className="font-mono text-slate-700">{fmt(fut.markPrice)}</span></span>
            <span>Funding <span className={`font-mono font-semibold ${fut.fundingRate >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {(fut.fundingRate * 100).toFixed(4)}%</span>
              {fundingLeft != null && <span className="ml-1 font-mono text-slate-400">in {hms(fundingLeft)}</span>}
            </span>
            <span>OI <span className="font-mono text-slate-700">${(fut.openInterestUsd / 1e6).toFixed(1)}M</span></span>
          </div>
        )}
        {rsiNow !== null && (
          <div className="flex items-center gap-2 ml-auto">
            <Activity size={13} className="text-slate-400" />
            <span className="text-xs text-slate-500">RSI-14</span>
            <span className="font-bold text-sm" style={{ color: rsiColor }}>{rsiNow}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold border" style={{ background: rsiColor + '18', color: rsiColor, borderColor: rsiColor + '40' }}>{rsiLabel}</span>
          </div>
        )}
      </div>

      {/* Chart card */}
      <div className="card glow-border overflow-hidden relative mb-4">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10"><RefreshCw size={24} className="text-blue-500 animate-spin" /></div>
        )}
        {loadError && !loading && (
          <div className="absolute inset-x-0 top-10 z-10 mx-auto w-fit rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600">{loadError}</div>
        )}
        <div className="px-2 pt-3 pb-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 px-3 mb-2">
            <span>{symbol} · {timeframe}</span>
            {showEma && [20, 50, 100].map(p => <span key={p} style={{ color: EMA_COLORS[p] }}>━ EMA{p}</span>)}
            {showTrades && <span className="text-slate-400">▲ entry · ● exit · ━ entry/SL/TP/Liq · ┈ 🔔 alert</span>}
          </div>
          <div ref={mainRef} />
        </div>
        <div className="px-2 pb-3 border-t border-slate-100 mt-1">
          <div className="text-xs font-semibold text-slate-500 px-3 mt-2 mb-1">RSI (14) · Buy &lt;60 · Sell &gt;70</div>
          <div ref={rsiRef} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Bot view */}
        <div className="card glow-border p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bot size={16} className="text-blue-500" />
            <h2 className="text-sm font-bold text-slate-800">Bot&apos;s view</h2>
            {bot?.timeframe && <span className="ml-auto text-[11px] text-slate-400">on the bot&apos;s {bot.timeframe} chart</span>}
          </div>
          {!ctx ? <p className="text-xs text-slate-400">Loading…</p> : !bot || bot.error ? (
            <p className="text-xs text-slate-400">{bot?.error || 'Not enough data'}</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: sigColor + '1a', color: sigColor }}>
                  {bot.signal === 'BUY' ? 'BUY signal' : bot.signal === 'SELL' ? 'SELL signal' : 'HOLD — no signal'}
                </span>
                <span className="text-xs text-slate-500">RSI {bot.rsi} · {bot.uptrend ? 'uptrend' : 'downtrend'} · {bot.macroUptrend ? 'above' : 'below'} EMA100</span>
              </div>
              <div className={`mb-3 rounded-lg px-3 py-2 text-xs font-semibold ${bot.wouldTrade ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {bot.signal === 'HOLD' ? 'No trade: there is no signal right now.'
                  : !bot.checklistOn ? `Checklist is off — the bot would act on this ${bot.signal}.`
                  : bot.wouldTrade ? `✓ Checklist ${bot.passed}/${bot.total} — the bot would take this ${bot.direction}.`
                  : `✗ Checklist ${bot.passed}/${bot.total} (needs ${bot.minPass}) — the bot would skip it.`}
              </div>
              <ul className="space-y-1">
                {bot.checklist.map(c => (
                  <li key={c.id} className="flex items-start gap-2 text-xs">
                    {c.skipped ? <MinusCircle size={13} className="mt-0.5 shrink-0 text-slate-300" />
                      : c.pass ? <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                      : <XCircle size={13} className="mt-0.5 shrink-0 text-red-400" />}
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-700">{c.name}</span>
                      <span className="block truncate text-slate-400">{c.skipped ? `skipped — ${c.detail}` : c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {bot.sentiment && (
                <div className="mt-3 flex items-start gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <Brain size={13} className="mt-0.5 shrink-0 text-violet-500" />
                  <span>AI: <strong className={bot.sentiment.sentiment === 'bullish' ? 'text-emerald-600' : bot.sentiment.sentiment === 'bearish' ? 'text-red-500' : 'text-slate-600'}>
                    {bot.sentiment.sentiment} {bot.sentiment.confidence}%</strong> — {bot.sentiment.reason}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Open positions */}
        <div className="card glow-border p-4">
          <div className="mb-3 flex items-center gap-2">
            <Crosshair size={16} className="text-blue-500" />
            <h2 className="text-sm font-bold text-slate-800">My position</h2>
            {ctx?.mode && ctx.mode !== 'live' && <span className="ml-auto rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-600">{ctx.mode}</span>}
          </div>
          {!ctx?.positions?.length ? (
            <p className="text-xs text-slate-400">No open {market} position on {symbol}.{ctx?.trades?.length ? ` ${ctx.trades.length} past trade(s) are marked on the chart.` : ''}</p>
          ) : ctx.positions.map(p => {
            const long = p.side !== 'SHORT';
            const upnl = price ? (long ? price - p.entry : p.entry - price) * p.qty : null;
            return (
              <div key={p.id} className="mb-3 rounded-lg border border-slate-100 p-3 last:mb-0">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${long ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {p.side}{p.leverage ? ` ${p.leverage}x` : ''}{p.source === 'manual' ? ' · manual' : ''}
                  </span>
                  {upnl !== null && <span className={`font-mono text-sm font-bold ${upnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {money(upnl)}{p.margin ? <span className="ml-1 text-xs">({((upnl / p.margin) * 100).toFixed(1)}%)</span> : null}</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span className="text-slate-400">Entry <span className="font-mono text-slate-700">{fmt(p.entry)}</span></span>
                  <span className="text-slate-400">Qty <span className="font-mono text-slate-700">{p.qty}</span></span>
                  <span className="text-slate-400">SL <span className="font-mono text-red-500">{fmt(p.stopLoss)}</span></span>
                  <span className="text-slate-400">TP <span className="font-mono text-emerald-600">{fmt(p.takeProfit)}</span></span>
                  {p.liquidationPrice && <span className="col-span-2 text-slate-400">Liquidation <span className="font-mono text-orange-500">{fmt(p.liquidationPrice)}</span></span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Price alerts */}
        <div className="card glow-border p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bell size={16} className="text-blue-500" />
            <h2 className="text-sm font-bold text-slate-800">Price alerts</h2>
            <span className="ml-auto text-[11px] text-slate-400">push + email</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="number" step="any" value={alertPrice} onChange={e => setAlertPrice(e.target.value)}
              placeholder={price ? `e.g. ${fmt(price * 1.02)}` : 'Price'}
              className="input min-w-0 flex-1 py-1.5 text-sm font-mono" style={{ width: 'auto' }} />
            <button onClick={addAlert} disabled={!alertPrice}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
              <BellRing size={12} /> Add
            </button>
          </div>
          <input value={alertNote} onChange={e => setAlertNote(e.target.value)} maxLength={120}
            placeholder="Note (optional)" className="input mt-2 py-1.5 text-sm" />
          {price && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[-5, -2, 2, 5].map(pct => (
                <button key={pct} onClick={() => setAlertPrice(String(+(price * (1 + pct / 100)).toPrecision(6)))}
                  className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-200">
                  {pct > 0 ? '+' : ''}{pct}%
                </button>
              ))}
            </div>
          )}
          {alertMsg && <p className="mt-2 text-xs font-medium text-slate-600">{alertMsg}</p>}
          <ul className="mt-3 divide-y divide-slate-100">
            {alerts.active.map(a => (
              <li key={a._id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-slate-700">{a.condition === 'above' ? '≥' : '≤'} ${fmt(a.price)}</div>
                  {a.note && <div className="truncate text-slate-400">{a.note}</div>}
                </div>
                <button onClick={() => removeAlert(a._id)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Delete alert">
                  <X size={13} />
                </button>
              </li>
            ))}
            {!alerts.active.length && <li className="py-2 text-xs text-slate-400">No active alerts on {symbol}.</li>}
          </ul>
          {alerts.triggered.length > 0 && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recently triggered</div>
              {alerts.triggered.slice(0, 4).map(a => (
                <div key={a._id} className="flex items-center justify-between py-0.5 text-[11px] text-slate-500">
                  <span>{a.symbol} {a.condition === 'above' ? '≥' : '≤'} {fmt(a.price)}</span>
                  <span>{new Date(a.triggeredAt).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
