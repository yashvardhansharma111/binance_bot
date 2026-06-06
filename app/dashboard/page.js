'use client';
import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, Bot, Wallet, Users, Activity,
  Play, Square, RefreshCw, ArrowRight, Crown, CheckCircle2, Lock,
  AlertCircle, Copy, Check, ArrowUpCircle, ArrowDownCircle,
  Zap, AlertTriangle, LogOut,
} from 'lucide-react';
import SymbolSearch from '@/components/SymbolSearch';

const LEVERAGES = [1, 2, 3, 5, 10, 20, 50, 75, 100, 125];

function StatCard({ title, value, sub, icon: Icon, iconBg, iconColor, trend, href }) {
  const inner = (
    <>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-slate-500 text-xs mb-1">{title}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
          <Icon size={16} style={{ color: iconColor }} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {Math.abs(trend)}% this week
        </div>
      )}
    </>
  );
  if (href) return (
    <a href={href} className="card p-5 glow-border block transition-all hover:shadow-md active:scale-95" style={{ cursor: 'pointer' }}>
      {inner}
    </a>
  );
  return <div className="card p-5 glow-border">{inner}</div>;
}

function QuickTrade({ balances, onTradeComplete }) {
  const [mode,        setMode]        = useState('spot');   // 'spot' | 'futures'
  const [symbol,      setSymbol]      = useState('BTCUSDT');
  const [side,        setSide]        = useState('BUY');
  const [amount,      setAmount]      = useState('');
  const [sl,          setSl]          = useState('');
  const [tp,          setTp]          = useState('');
  const [leverage,    setLeverage]    = useState(10);
  const [margin,      setMargin]      = useState('');
  const [price,       setPrice]       = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState('');
  const [openTrades,  setOpenTrades]  = useState([]);
  const [livePrices,  setLivePrices]  = useState({});
  const [exitLoading, setExitLoading] = useState('');
  const [exitMsg,     setExitMsg]     = useState(null);
  const openRef = useRef([]);
  const ivlRef  = useRef(null);

  useEffect(() => {
    fetchPrice();
  }, [symbol]);

  useEffect(() => {
    fetchOpenTrades();
    ivlRef.current = setInterval(refreshPrices, 4000);
    return () => clearInterval(ivlRef.current);
  }, []);

  async function fetchPrice() {
    setPrice(null);
    try {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      const d = await r.json();
      setPrice(parseFloat(d.price));
    } catch { /* ignore */ }
  }

  async function fetchOpenTrades() {
    const res  = await fetch('/api/trades?status=open&limit=50');
    const data = await res.json();
    const list = data.trades || [];
    setOpenTrades(list);
    openRef.current = list;
    refreshPricesFor(list);
  }

  async function refreshPrices() {
    refreshPricesFor(openRef.current);
  }

  async function refreshPricesFor(list) {
    const syms = [...new Set(list.map(t => t.symbol))];
    if (!syms.length) return;
    const pairs = await Promise.all(syms.map(async sym => {
      try {
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
        const d = await r.json();
        return [sym, parseFloat(d.price)];
      } catch { return [sym, null]; }
    }));
    setLivePrices(Object.fromEntries(pairs));
  }

  async function placeSpot() {
    setError(''); setResult(null);
    if (side === 'BUY' && (!amount || parseFloat(amount) < 10)) {
      setError('Enter USDT amount (min $10)'); return;
    }
    setLoading(true);
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res   = await fetch('/api/trade/manual', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol, side,
          usdtAmount:        side === 'BUY' ? parseFloat(amount) : undefined,
          stopLossPercent:   sl ? parseFloat(sl)   : undefined,
          takeProfitPercent: tp ? parseFloat(tp)   : undefined,
        }),
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Order failed'); return; }
      setResult(`${data.trade.side} ${data.order.qty} ${symbol.replace('USDT','')} @ $${data.order.price?.toLocaleString()}`);
      setAmount(''); setSl(''); setTp('');
      onTradeComplete?.();
      fetchOpenTrades();
    } catch (err) {
      setError(err.name === 'AbortError' ? 'Request timed out — check History' : `Error: ${err.message}`);
    } finally { setLoading(false); }
  }

  async function placeFutures() {
    setError(''); setResult(null);
    if (!margin || parseFloat(margin) < 5) { setError('Minimum margin is $5'); return; }
    setLoading(true);
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res   = await fetch('/api/trade/futures', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side:       side === 'BUY' ? 'BUY' : 'SELL',
          usdtMargin: parseFloat(margin),
          leverage,
          orderType:  'MARKET',
        }),
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Order failed'); return; }
      const s = data.summary;
      setResult(`${side === 'BUY' ? 'LONG' : 'SHORT'} ${s.qty} ${symbol.replace('USDT','')} @ $${s.entryPrice?.toLocaleString()} × ${leverage}x`);
      setMargin('');
    } catch (err) {
      setError(err.name === 'AbortError' ? 'Request timed out — check History' : `Error: ${err.message}`);
    } finally { setLoading(false); }
  }

  async function exitTrade(tradeId) {
    setExitMsg(null); setExitLoading(tradeId);
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res   = await fetch('/api/trade/exit', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId }),
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) { setExitMsg({ err: data.error || 'Exit failed' }); return; }
      setExitMsg({ ok: `Exited @ $${data.order?.price?.toLocaleString()} · P&L: ${data.profit >= 0 ? '+' : ''}$${data.profit?.toFixed(4)}` });
      onTradeComplete?.();
      fetchOpenTrades();
    } catch (err) {
      setExitMsg({ err: err.name === 'AbortError' ? 'Timed out — check History' : 'Network error' });
    } finally { setExitLoading(''); }
  }

  const usdtBal  = balances?.balances?.find(b => b.asset === 'USDT')?.free || 0;
  const posValue = price && margin ? (parseFloat(margin) * leverage).toFixed(2) : null;
  const liqEst   = price && margin && side === 'BUY'
    ? (price * (1 - 1 / leverage * 0.9)).toFixed(2) : null;

  const isLong = side === 'BUY';

  return (
    <div className="card glow-border p-5 mb-5">
      {/* Header + mode tabs */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Zap size={15} className="text-blue-500" /> Quick Trade
        </h2>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {['spot','futures'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setResult(null); }}
              className="px-3 py-1 rounded-md text-xs font-bold transition-all"
              style={{
                background:  mode === m ? '#fff' : 'transparent',
                color:       mode === m ? '#1e40af' : '#64748b',
                boxShadow:   mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Symbol + price */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <SymbolSearch value={symbol} onChange={s => { setSymbol(s); setError(''); setResult(null); }} size="sm" />
        {price && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-slate-900">
              ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
            </span>
            <button onClick={fetchPrice} className="text-[10px] text-blue-500 hover:underline">↻</button>
          </div>
        )}
      </div>

      {/* Side buttons */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setSide('BUY')}
          className="flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all"
          style={{
            background:  isLong ? '#16a34a' : '#f0fdf4',
            color:       isLong ? '#fff'    : '#16a34a',
            borderColor: '#16a34a',
          }}>
          {mode === 'futures' ? 'LONG' : <><ArrowUpCircle size={13} className="inline mr-1" />BUY</>}
        </button>
        <button onClick={() => setSide('SELL')}
          className="flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all"
          style={{
            background:  !isLong ? '#dc2626' : '#fef2f2',
            color:       !isLong ? '#fff'    : '#dc2626',
            borderColor: '#dc2626',
          }}>
          {mode === 'futures' ? 'SHORT' : <><ArrowDownCircle size={13} className="inline mr-1" />SELL</>}
        </button>
      </div>

      {mode === 'spot' ? (
        <>
          {/* Spot form */}
          <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg mb-3">
            USDT available: <strong className="text-slate-700">${usdtBal.toFixed(2)}</strong>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                {side === 'BUY' ? 'Amount to spend (USDT)' : 'Qty to sell (leave blank = close open position)'}
              </label>
              <input type="number" min="10" placeholder={side === 'BUY' ? 'e.g. 100' : 'optional'}
                value={amount} onChange={e => setAmount(e.target.value)}
                className="input w-full" />
              {side === 'BUY' && price && amount && (
                <div className="text-xs text-slate-400 mt-1">
                  ≈ <strong>{(parseFloat(amount)/price).toFixed(6)}</strong> {symbol.replace('USDT','')}
                </div>
              )}
              {side === 'BUY' && (
                <div className="flex gap-1.5 mt-2">
                  {[25,50,75,100].map(p => (
                    <button key={p} onClick={() => setAmount((usdtBal * p / 100).toFixed(2))}
                      className="flex-1 py-1 text-xs font-semibold rounded border border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-colors">
                      {p}%
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">SL % <span className="text-slate-400 font-normal">(opt)</span></label>
                <div className="flex items-center gap-1">
                  <input type="number" min="0.1" max="50" step="0.1" placeholder="2"
                    value={sl} onChange={e => setSl(e.target.value)} className="input flex-1 text-sm" />
                  <span className="text-xs text-slate-400">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">TP % <span className="text-slate-400 font-normal">(opt)</span></label>
                <div className="flex items-center gap-1">
                  <input type="number" min="0.1" max="100" step="0.1" placeholder="4"
                    value={tp} onChange={e => setTp(e.target.value)} className="input flex-1 text-sm" />
                  <span className="text-xs text-slate-400">%</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Futures form */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-2">Leverage</label>
            <div className="flex flex-wrap gap-1.5">
              {LEVERAGES.map(lv => (
                <button key={lv} onClick={() => setLeverage(lv)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-all"
                  style={{
                    background:  leverage === lv ? '#2563eb' : '#f8fafc',
                    color:       leverage === lv ? '#fff'    : '#64748b',
                    borderColor: leverage === lv ? '#2563eb' : '#e2e8f0',
                  }}>
                  {lv}x
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Margin (USDT)</label>
            <input type="number" min="5" placeholder="e.g. 50"
              value={margin} onChange={e => setMargin(e.target.value)}
              className="input w-full" />
            <div className="flex gap-4 mt-1.5 text-xs text-slate-400">
              {posValue && <span>Position: <strong className="text-slate-700">${posValue}</strong></span>}
              {liqEst   && <span>Est. Liq: <strong className="text-red-500">${liqEst}</strong></span>}
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
          <AlertTriangle size={13} /> {error}
        </div>
      )}
      {result && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 size={13} /> {result}
        </div>
      )}

      <button
        onClick={mode === 'spot' ? placeSpot : placeFutures}
        disabled={loading}
        className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
        style={{ background: isLong ? '#16a34a' : '#dc2626', color: '#fff' }}>
        {loading
          ? <RefreshCw size={15} className="animate-spin" />
          : isLong ? <ArrowUpCircle size={15} /> : <ArrowDownCircle size={15} />}
        {loading ? 'Placing...' : mode === 'futures'
          ? `Open ${isLong ? 'LONG' : 'SHORT'} — ${leverage}x`
          : `Place ${side} Order`}
      </button>

      {/* Open positions */}
      {openTrades.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">Open Positions</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          </div>

          {exitMsg?.err && (
            <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <AlertTriangle size={12} /> {exitMsg.err}
            </div>
          )}
          {exitMsg?.ok && (
            <div className="mb-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 size={12} /> {exitMsg.ok}
            </div>
          )}

          <div className="space-y-2">
            {openTrades.map(t => {
              const live   = livePrices[t.symbol];
              const pnl    = live ? parseFloat(((live - t.price) * t.qty).toFixed(4)) : null;
              const pnlPct = live ? ((live - t.price) / t.price * 100).toFixed(2) : null;
              const up     = pnl !== null && pnl >= 0;
              return (
                <div key={t._id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">{t.symbol}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">BUY</span>
                      {t.source === 'bot' && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-50 text-violet-600">Bot</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px]">
                      <span className="text-slate-400">@ <span className="font-mono font-semibold text-slate-700">${t.price?.toLocaleString()}</span></span>
                      <span className="text-slate-400">qty <span className="font-mono text-slate-700">{t.qty}</span></span>
                      {pnl !== null && (
                        <span className={`font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                          {up ? '+' : ''}${pnl} ({up ? '+' : ''}{pnlPct}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => exitTrade(t._id)} disabled={exitLoading === t._id}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-all"
                    style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                    {exitLoading === t._id ? <RefreshCw size={11} className="animate-spin" /> : <LogOut size={11} />}
                    Exit
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [user,       setUser]       = useState(null);
  const [trades,     setTrades]     = useState([]);
  const [sub,        setSub]        = useState(null);
  const [balances,   setBalances]   = useState(null);
  const [balLoading, setBalLoading] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [botLoading, setBotLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    const [uRes, tRes, sRes] = await Promise.all([
      fetch('/api/user'),
      fetch('/api/trades?limit=5'),
      fetch('/api/subscription'),
    ]);
    const u = await uRes.json();
    const t = await tRes.json();
    const s = await sRes.json();
    setUser(u);
    setTrades(t.trades || []);
    const daysLeft = s.expiry ? Math.ceil((new Date(s.expiry) - new Date()) / 86400000) : 0;
    setSub({ active: s.active, expiry: s.expiry, daysLeft });
    setLoading(false);
  }

  async function fetchBalance() {
    setBalLoading(true);
    try {
      const res  = await fetch('/api/balance');
      const data = await res.json();
      setBalances(data);
    } catch (err) {
      setBalances({ error: `Network error: ${err.message}` });
    } finally {
      setBalLoading(false);
    }
  }

  useEffect(() => {
    if (session === undefined) return;
    loadData();
    fetchBalance();
  }, [session]);

  async function toggleBot() {
    if (!sub?.active) { router.push('/dashboard/subscribe'); return; }
    setBotLoading(true);
    const action = user?.botActive ? 'stop' : 'start';
    await fetch(`/api/bot/${action}`, { method: 'POST' });
    await loadData();
    setBotLoading(false);
  }

  const [refCopied, setRefCopied] = useState(false);

  function copyReferral() {
    if (!user?.referralCode) return;
    const link = `${window.location.origin}/register?ref=${user.referralCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setRefCopied(true);
      setTimeout(() => setRefCopied(false), 2000);
    });
  }

  const totalProfit = trades.reduce((s, t) => s + (t.profit || 0), 0);
  const firstName   = session?.user?.name?.split(' ')[0];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={22} className="text-blue-500 animate-spin" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 lg:text-2xl">Dashboard</h1>
          <p className="text-slate-500 mt-0.5 text-xs lg:text-sm">Welcome back, {firstName}</p>
        </div>
        <button onClick={toggleBot} disabled={botLoading}
          className={`flex items-center gap-2 px-4 py-2 lg:px-5 lg:py-2.5 rounded-lg text-sm font-semibold transition-all ${
            user?.botActive
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'btn-primary'
          }`}>
          {botLoading
            ? <RefreshCw size={15} className="animate-spin" />
            : user?.botActive ? <Square size={15} /> : !sub?.active ? <Lock size={15} /> : <Play size={15} />}
          {user?.botActive ? 'Stop' : 'Start Bot'}
        </button>
      </div>

      {/* Subscription banner */}
      {!sub?.active ? (
        <div className="mb-5 rounded-2xl overflow-hidden border border-blue-200"
          style={{ background: 'linear-gradient(135deg, #1e40af 0%, #4f46e5 100%)' }}>
          <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Crown size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="text-white font-bold text-base">Unlock AI Trading Bot</div>
              <div className="text-blue-200 text-xs mt-0.5">Subscribe for 6 months and let AI trade for you 24/7</div>
            </div>
            <button onClick={() => router.push('/dashboard/subscribe')}
              className="shrink-0 bg-white text-blue-700 font-bold text-sm px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
              Subscribe — $49
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-5 px-4 py-3 rounded-xl flex items-center gap-3 text-sm border"
          style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>
          <Crown size={15} />
          <span>
            <strong>Pro subscription</strong> active — {sub.daysLeft} days remaining
            <span className="text-xs text-emerald-600 ml-1">
              (expires {new Date(sub.expiry).toLocaleDateString()})
            </span>
          </span>
          {user?.botActive && <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Bot running
          </span>}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <StatCard
          title="Binance USDT"
          value={balLoading && !balances
            ? '...'
            : balances?.error
              ? 'N/A'
              : `$${(balances?.balances?.find(b => b.asset === 'USDT')?.free ?? 0).toFixed(2)}`}
          sub="Exchange balance"
          icon={Wallet} iconBg="#eff6ff" iconColor="#2563eb"
        />
        <StatCard
          title="Asset Balance"
          value={`$${(user?.assetBalance ?? 0).toFixed(2)}`}
          sub="Deposits + commissions"
          icon={Activity} iconBg="#ecfeff" iconColor="#0891b2"
          href="/dashboard/deposit"
        />
        <StatCard
          title="Total Profit"
          value={`${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}`}
          sub="From all trades"
          icon={TrendingUp}
          iconBg={totalProfit >= 0 ? '#f0fdf4' : '#fef2f2'}
          iconColor={totalProfit >= 0 ? '#16a34a' : '#dc2626'}
          trend={totalProfit >= 0 ? 5.2 : -1.8}
        />
        <button onClick={copyReferral}
          className="card p-5 glow-border text-left w-full transition-all active:scale-95 hover:shadow-md"
          style={{ cursor: 'pointer' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1">
              <p className="text-slate-500 text-xs mb-1">Referral Code</p>
              <p className="text-xl font-bold text-slate-900 font-mono tracking-wide">
                {user?.referralCode || '—'}
              </p>
              <p className="text-xs mt-0.5 flex items-center gap-1"
                style={{ color: refCopied ? '#16a34a' : '#94a3b8' }}>
                {refCopied ? <><Check size={11} /> Link copied!</> : <><Copy size={11} /> Tap to copy link</>}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              style={{ background: refCopied ? '#f0fdf4' : '#fefce8' }}>
              {refCopied
                ? <Check size={16} className="text-emerald-500" />
                : <Users size={16} style={{ color: '#b45309' }} />}
            </div>
          </div>
        </button>
      </div>

      {/* Binance Balance */}
      <div className="card p-5 glow-border mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet size={15} className="text-blue-500" />
            <h2 className="text-sm font-bold text-slate-900">Binance Balance</h2>
            {balances?.dryRun && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold border border-amber-200">
                DRY RUN
              </span>
            )}
          </div>
          <button onClick={fetchBalance} disabled={balLoading}
            className="btn-outline py-1 px-3 text-xs flex items-center gap-1.5">
            <RefreshCw size={11} className={balLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {balLoading && !balances && (
          <div className="flex items-center justify-center py-6">
            <RefreshCw size={18} className="text-blue-400 animate-spin" />
          </div>
        )}

        {balances?.error && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-lg">
            <AlertCircle size={14} className="shrink-0" />
            {balances.error === 'No API key configured'
              ? <span>No Binance API key found. <a href="/dashboard/apikeys" className="underline font-semibold">Add one here.</a></span>
              : balances.error}
          </div>
        )}

        {balances?.balances && balances.balances.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Wallet size={28} className="mb-2 opacity-20" style={{ color: 'var(--text-2)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>$0.00</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>No assets with a non-zero balance</p>
          </div>
        )}

        {balances?.balances && balances.balances.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {balances.balances.slice(0, 8).map(b => {
              const isUsdt = b.asset === 'USDT';
              return (
                <div key={b.asset}
                  className="rounded-xl px-3 py-2.5 border transition-colors"
                  style={{
                    background:  isUsdt ? '#eff6ff' : '#f8fafc',
                    borderColor: isUsdt ? '#bfdbfe' : '#e2e8f0',
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color: isUsdt ? '#2563eb' : '#64748b' }}>
                      {b.asset}
                    </span>
                    {b.locked > 0 && (
                      <span className="text-[10px] text-amber-500 font-semibold">
                        {b.locked.toFixed(4)} locked
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {b.free < 0.0001
                      ? b.free.toExponential(2)
                      : b.free.toLocaleString(undefined, { maximumFractionDigits: isUsdt ? 2 : 6 })}
                  </div>
                </div>
              );
            })}
            {balances.balances.length > 8 && (
              <div className="rounded-xl px-3 py-2.5 border border-dashed border-slate-200 flex items-center justify-center">
                <span className="text-xs text-slate-400">+{balances.balances.length - 8} more</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Trade */}
      <QuickTrade balances={balances} onTradeComplete={loadData} />

      {/* Recent trades */}
      <div className="card p-5 glow-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">Recent Trades</h2>
          <a href="/dashboard/trades" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            View all <ArrowRight size={12} />
          </a>
        </div>
        {trades.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Bot size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">No trades yet. {sub?.active ? 'Start the bot or place a trade above.' : 'Subscribe to start trading.'}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {trades.map(trade => (
              <div key={trade._id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    trade.side === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                  }`}>{trade.side}</span>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{trade.symbol}</div>
                    <div className="text-xs text-slate-400">{trade.source === 'manual' ? 'Manual' : 'Auto Trade'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-slate-700">${trade.price?.toFixed(2)}</div>
                  {trade.status === 'closed' && (
                    <div className={`text-xs font-semibold ${trade.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {trade.profit >= 0 ? '+' : ''}{trade.profit?.toFixed(2)}
                    </div>
                  )}
                  {trade.status === 'open' && (
                    <div className="text-xs text-blue-500 font-semibold">Open</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
