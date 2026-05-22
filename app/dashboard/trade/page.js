'use client';
import { useEffect, useState } from 'react';
import {
  ArrowUpCircle, ArrowDownCircle, RefreshCw, AlertTriangle,
  CheckCircle2, Zap, TrendingUp, TrendingDown, LogOut,
} from 'lucide-react';
import SymbolSearch from '@/components/SymbolSearch';

export default function ManualTradePage() {
  const [symbol,      setSymbol]      = useState('BTCUSDT');
  const [side,        setSide]        = useState('BUY');
  const [amount,      setAmount]      = useState('');
  const [qty,         setQty]         = useState('');
  const [sl,          setSl]          = useState('');
  const [tp,          setTp]          = useState('');
  const [price,       setPrice]       = useState(null);
  const [balance,     setBalance]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState('');
  const [openTrades,  setOpenTrades]  = useState([]);
  const [livePrices,  setLivePrices]  = useState({});
  const [exitLoading, setExitLoading] = useState('');
  const [exitResult,  setExitResult]  = useState(null);
  const [exitError,   setExitError]   = useState('');

  useEffect(() => { fetchPrice(); }, [symbol]);
  useEffect(() => { fetchBalance(); fetchOpenTrades(); }, []);

  async function fetchPrice() {
    setPrice(null);
    try {
      const res  = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      const data = await res.json();
      setPrice(parseFloat(data.price));
    } catch { /* ignore */ }
  }

  async function fetchBalance() {
    const res  = await fetch('/api/balance');
    const data = await res.json();
    setBalance(data);
  }

  async function fetchOpenTrades() {
    const res    = await fetch('/api/trades?status=open&limit=50');
    const data   = await res.json();
    const trades = data.trades || [];
    setOpenTrades(trades);
    const symbols = [...new Set(trades.map(t => t.symbol))];
    if (!symbols.length) return;
    const pairs = await Promise.all(
      symbols.map(async sym => {
        try {
          const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
          const d = await r.json();
          return [sym, parseFloat(d.price)];
        } catch { return [sym, null]; }
      })
    );
    setLivePrices(Object.fromEntries(pairs));
  }

  async function exitTrade(tradeId) {
    setExitError(''); setExitResult(null); setExitLoading(tradeId);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch('/api/trade/exit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  controller.signal,
        body:    JSON.stringify({ tradeId }),
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) { setExitError(data.error || 'Exit failed'); return; }
      setExitResult(data);
      await fetchOpenTrades();
      fetchBalance();
    } catch (err) {
      setExitError(err.name === 'AbortError' ? 'Request timed out — check History' : 'Network error');
    } finally {
      setExitLoading('');
    }
  }

  async function placeOrder() {
    setError(''); setResult(null);
    if (side === 'BUY' && (!amount || parseFloat(amount) < 10)) {
      setError('Enter USDT amount (min $10)'); return;
    }
    setLoading(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch('/api/trade/manual', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  controller.signal,
        body:    JSON.stringify({
          symbol, side,
          usdtAmount:        side === 'BUY' ? parseFloat(amount) : undefined,
          qty:               side === 'SELL' && qty ? parseFloat(qty) : undefined,
          stopLossPercent:   sl ? parseFloat(sl) : undefined,
          takeProfitPercent: tp ? parseFloat(tp) : undefined,
        }),
      });
      clearTimeout(timer);
      let data;
      try { data = await res.json(); } catch {
        setError(`Server error (HTTP ${res.status}) — check History.`); return;
      }
      if (!res.ok) { setError(data.error || 'Order failed'); return; }
      setResult(data);
      setAmount(''); setQty('');
      fetchBalance(); fetchOpenTrades();
    } catch (err) {
      setError(err.name === 'AbortError'
        ? 'Request timed out (20s) — check History to see if order was placed.'
        : `Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const usdtBal = balance?.balances?.find(b => b.asset === 'USDT')?.free || 0;
  const coinBal = balance?.balances?.find(b => b.asset === symbol.replace('USDT',''))?.free || 0;
  const estQty  = price && amount ? (parseFloat(amount) / price).toFixed(6) : '—';
  const estVal  = price && qty    ? (parseFloat(qty) * price).toFixed(2)   : '—';

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 lg:text-2xl flex items-center gap-2">
          <Zap size={20} className="text-blue-500" /> Manual Trade
        </h1>
        <p className="text-slate-500 mt-0.5 text-xs lg:text-sm">Place market orders directly on Binance</p>
      </div>

      {/* Pair selector */}
      <div className="card glow-border p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SymbolSearch value={symbol} onChange={s => { setSymbol(s); }} />
          {price && (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </span>
              <button onClick={fetchPrice} className="text-xs text-blue-500 hover:underline">Refresh</button>
            </div>
          )}
        </div>
      </div>

      {/* Order form */}
      <div className="card glow-border p-5 space-y-4">
        {/* BUY / SELL tabs */}
        <div className="flex gap-2">
          <button onClick={() => setSide('BUY')}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold border-2 transition-all"
            style={{
              background:  side === 'BUY' ? '#16a34a' : '#f0fdf4',
              color:       side === 'BUY' ? '#fff' : '#16a34a',
              borderColor: '#16a34a',
            }}>
            <ArrowUpCircle size={15} className="inline mr-1.5" />BUY
          </button>
          <button onClick={() => setSide('SELL')}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold border-2 transition-all"
            style={{
              background:  side === 'SELL' ? '#dc2626' : '#fef2f2',
              color:       side === 'SELL' ? '#fff' : '#dc2626',
              borderColor: '#dc2626',
            }}>
            <ArrowDownCircle size={15} className="inline mr-1.5" />SELL
          </button>
        </div>

        {/* Balance info */}
        <div className="flex justify-between text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
          <span>USDT available: <strong className="text-slate-700">${usdtBal.toFixed(2)}</strong></span>
          <span>{symbol.replace('USDT','')} held: <strong className="text-slate-700">{coinBal.toFixed(6)}</strong></span>
        </div>

        {side === 'BUY' ? (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Amount to spend (USDT)</label>
            <input type="number" min="10" placeholder="e.g. 100"
              value={amount} onChange={e => setAmount(e.target.value)}
              className="input w-full" />
            <div className="text-xs text-slate-400 mt-1.5">
              You will receive ≈ <strong>{estQty}</strong> {symbol.replace('USDT','')}
            </div>
            <div className="flex gap-2 mt-2">
              {[25,50,75,100].map(pct => (
                <button key={pct} onClick={() => setAmount((usdtBal * pct / 100).toFixed(2))}
                  className="flex-1 py-1 text-xs font-semibold rounded border border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-colors">
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Qty to sell ({symbol.replace('USDT','')}) — leave blank to sell open position
            </label>
            <input type="number" min="0" placeholder={`e.g. ${coinBal.toFixed(4) || '0.001'}`}
              value={qty} onChange={e => setQty(e.target.value)}
              className="input w-full" />
            {qty && <div className="text-xs text-slate-400 mt-1.5">≈ <strong>${estVal}</strong> USDT</div>}
          </div>
        )}

        {/* Risk controls */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Stop Loss % <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-1">
              <input type="number" min="0.1" max="50" step="0.1" placeholder="e.g. 2"
                value={sl} onChange={e => setSl(e.target.value)}
                className="input flex-1 text-sm" />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Take Profit % <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-1">
              <input type="number" min="0.1" max="100" step="0.1" placeholder="e.g. 4"
                value={tp} onChange={e => setTp(e.target.value)}
                className="input flex-1 text-sm" />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {result && (
          <div className="px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
            <CheckCircle2 size={14} />
            {result.trade.side} {result.order.qty} {symbol.replace('USDT','')} @ ${result.order.price?.toLocaleString()}
            {result.trade.stopLoss && ` | SL: $${result.trade.stopLoss}`}
            {result.trade.takeProfit && ` | TP: $${result.trade.takeProfit}`}
          </div>
        )}

        <button onClick={placeOrder} disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
          style={{ background: side === 'BUY' ? '#16a34a' : '#dc2626', color: '#fff' }}>
          {loading
            ? <RefreshCw size={16} className="animate-spin" />
            : side === 'BUY' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
          {loading ? 'Placing order...' : `Place ${side} Order`}
        </button>

        <p className="text-xs text-center text-slate-400">
          Market order — executes immediately at current price.
        </p>
      </div>

      {/* Open Positions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-slate-700">Open Positions</h2>
          <button onClick={fetchOpenTrades}
            className="text-xs text-blue-500 hover:underline flex items-center gap-1">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {exitError && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
            <AlertTriangle size={13} /> {exitError}
          </div>
        )}
        {exitResult && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 size={13} />
            Exited @ ${exitResult.order?.price?.toLocaleString()} · P&L: {exitResult.profit >= 0 ? '+' : ''}${exitResult.profit?.toFixed(4)}
          </div>
        )}

        {openTrades.length === 0 ? (
          <div className="card p-6 text-center text-slate-400 text-xs">
            No open positions
          </div>
        ) : (
          <div className="space-y-2">
            {openTrades.map(t => {
              const live    = livePrices[t.symbol];
              const pnl     = live ? parseFloat(((live - t.price) * t.qty).toFixed(4)) : null;
              const pnlPct  = live ? ((live - t.price) / t.price * 100).toFixed(2) : null;
              const profit  = pnl !== null && pnl >= 0;

              return (
                <div key={t._id} className="card glow-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{t.symbol}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          BUY
                        </span>
                        {t.source === 'manual' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-600">
                            Manual
                          </span>
                        )}
                        {t.source === 'bot' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-50 text-violet-600">
                            Bot
                          </span>
                        )}
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div>
                          <span className="text-slate-400">Entry</span>
                          <span className="ml-1.5 font-mono font-semibold text-slate-700">
                            ${t.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Qty</span>
                          <span className="ml-1.5 font-mono font-semibold text-slate-700">{t.qty}</span>
                        </div>
                        {live && (
                          <>
                            <div>
                              <span className="text-slate-400">Live</span>
                              <span className="ml-1.5 font-mono font-semibold text-slate-700">
                                ${live.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">P&L</span>
                              <span className={`ml-1.5 font-bold ${profit ? 'text-emerald-600' : 'text-red-500'}`}>
                                {profit ? '+' : ''}${pnl} ({profit ? '+' : ''}{pnlPct}%)
                              </span>
                              {profit
                                ? <TrendingUp  size={11} className="text-emerald-500" />
                                : <TrendingDown size={11} className="text-red-400" />}
                            </div>
                          </>
                        )}
                        {t.stopLoss && (
                          <div>
                            <span className="text-slate-400">SL</span>
                            <span className="ml-1.5 font-mono text-red-500">${t.stopLoss}</span>
                          </div>
                        )}
                        {t.takeProfit && (
                          <div>
                            <span className="text-slate-400">TP</span>
                            <span className="ml-1.5 font-mono text-emerald-600">${t.takeProfit}</span>
                          </div>
                        )}
                        <div className="col-span-2 text-slate-400">
                          Opened {new Date(t.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => exitTrade(t._id)}
                      disabled={exitLoading === t._id}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                      {exitLoading === t._id
                        ? <RefreshCw size={12} className="animate-spin" />
                        : <LogOut size={12} />}
                      Exit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
