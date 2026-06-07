'use client';
import { useEffect, useRef, useState } from 'react';
import { Activity, RefreshCw, TrendingUp, TrendingDown, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function TradePage() {
  const [trades,      setTrades]      = useState([]);
  const [livePrices,  setLivePrices]  = useState({});
  const [loading,     setLoading]     = useState(true);
  const [exitLoading, setExitLoading] = useState('');
  const [exitError,   setExitError]   = useState('');
  const [exitResult,  setExitResult]  = useState(null);
  const tradesRef = useRef([]);

  async function load() {
    setLoading(true);
    const res  = await fetch('/api/trades?status=open&limit=50');
    const data = await res.json();
    const list = data.trades || [];
    tradesRef.current = list;
    setTrades(list);
    setLoading(false);
    fetchLivePrices(list);
  }

  async function fetchLivePrices(list) {
    const symbols = [...new Set(list.map(t => t.symbol))];
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

  useEffect(() => {
    load();
    const iv = setInterval(() => fetchLivePrices(tradesRef.current), 4000);
    return () => clearInterval(iv);
  }, []);

  async function exitTrade(tradeId) {
    setExitError(''); setExitResult(null); setExitLoading(tradeId);
    try {
      const res  = await fetch('/api/trade/exit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tradeId }),
      });
      const data = await res.json();
      if (!res.ok) { setExitError(data.error || 'Exit failed'); return; }
      setExitResult(data);
      load();
    } catch {
      setExitError('Network error');
    } finally {
      setExitLoading('');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity size={20} className="text-blue-500" /> Active Trades
          </h1>
          <p className="text-slate-500 mt-0.5 text-sm">{trades.length} open position{trades.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={load} className="btn-outline py-2 px-4 flex items-center gap-2 text-sm">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {exitError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
          <AlertTriangle size={14} /> {exitError}
        </div>
      )}
      {exitResult && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle2 size={14} />
          Exited @ ${exitResult.order?.price?.toLocaleString()} · P&L: {exitResult.profit >= 0 ? '+' : ''}${exitResult.profit?.toFixed(4)}
        </div>
      )}

      {loading ? (
        <div className="card glow-border flex items-center justify-center h-40">
          <RefreshCw size={22} className="text-blue-500 animate-spin" />
        </div>
      ) : trades.length === 0 ? (
        <div className="card glow-border text-center py-16 text-slate-400">
          <Activity size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No active trades right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trades.map(t => {
            const live   = livePrices[t.symbol];
            const pnl    = live ? parseFloat(((live - t.price) * t.qty).toFixed(4)) : null;
            const pnlPct = live ? ((live - t.price) / t.price * 100).toFixed(2) : null;
            const profit = pnl !== null && pnl >= 0;

            return (
              <div key={t._id} className="card glow-border p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className="font-bold text-slate-900">{t.symbol}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">BUY</span>
                      {t.source === 'manual' && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-600">Manual</span>
                      )}
                      {t.source === 'bot' && (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-violet-50 text-violet-600">Bot</span>
                      )}
                      <span className="ml-auto flex items-center gap-1 text-xs font-bold"
                        style={{ color: pnl === null ? '#94a3b8' : profit ? '#16a34a' : '#ef4444' }}>
                        {pnl === null ? '—'
                          : <>{profit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              {profit ? '+' : ''}${pnl} ({profit ? '+' : ''}{pnlPct}%)</>}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-slate-400 block">Entry</span>
                        <span className="font-mono font-semibold text-slate-800">${t.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Qty</span>
                        <span className="font-mono text-slate-700">{t.qty}</span>
                      </div>
                      {live && (
                        <div>
                          <span className="text-slate-400 block">Live</span>
                          <span className="font-mono text-slate-700">${live.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400 block">Opened</span>
                        <span className="text-slate-600">{new Date(t.createdAt).toLocaleDateString()}</span>
                        <span className="text-slate-400 text-[10px] block">{new Date(t.createdAt).toLocaleTimeString()}</span>
                      </div>
                      {t.stopLoss && (
                        <div>
                          <span className="text-slate-400 block">Stop Loss</span>
                          <span className="font-mono text-red-500">${t.stopLoss}</span>
                        </div>
                      )}
                      {t.takeProfit && (
                        <div>
                          <span className="text-slate-400 block">Take Profit</span>
                          <span className="font-mono text-emerald-600">${t.takeProfit}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => exitTrade(t._id)}
                    disabled={exitLoading === t._id}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                    style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                    {exitLoading === t._id ? <RefreshCw size={13} className="animate-spin" /> : <LogOut size={13} />}
                    Exit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
