'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, Bot, Wallet, Users, Activity,
  Play, Square, RefreshCw, ArrowRight, Crown, CheckCircle2, Lock,
  AlertCircle,
} from 'lucide-react';

function StatCard({ title, value, sub, icon: Icon, iconBg, iconColor, trend }) {
  return (
    <div className="card p-5 glow-border">
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
    console.log('[balance] ▶ fetchBalance called');
    setBalLoading(true);
    try {
      console.log('[balance] → GET /api/balance');
      const res = await fetch('/api/balance');
      console.log(`[balance] ← HTTP ${res.status} ${res.statusText}`);

      let data;
      try {
        data = await res.json();
        console.log('[balance] response JSON:', data);
      } catch (parseErr) {
        console.error('[balance] failed to parse JSON:', parseErr.message);
        setBalances({ error: `Server returned non-JSON (status ${res.status})` });
        return;
      }

      if (!res.ok || data?.error) {
        console.warn('[balance] API error:', data?.error || `HTTP ${res.status}`);
      } else {
        console.log(`[balance] ✓ ${data.balances?.length ?? 0} assets loaded (accountType: ${data.accountType})`);
      }

      setBalances(data);
    } catch (networkErr) {
      console.error('[balance] network/fetch error:', networkErr.name, networkErr.message);
      setBalances({ error: `Network error: ${networkErr.message}` });
    } finally {
      console.log('[balance] ■ fetchBalance done, clearing loader');
      setBalLoading(false);
    }
  }

  useEffect(() => { loadData(); fetchBalance(); }, []);

  async function toggleBot() {
    if (!sub?.active) { router.push('/dashboard/subscribe'); return; }
    setBotLoading(true);
    const action = user?.botActive ? 'stop' : 'start';
    await fetch(`/api/bot/${action}`, { method: 'POST' });
    await loadData();
    setBotLoading(false);
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
              <div className="text-blue-200 text-xs mt-0.5">Subscribe for 6 months at $1 USDT and let AI trade for you 24/7</div>
            </div>
            <button onClick={() => router.push('/dashboard/subscribe')}
              className="shrink-0 bg-white text-blue-700 font-bold text-sm px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
              Subscribe — $1
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
          title="Fund Balance"
          value={`$${(user?.fundBalance || 0).toFixed(2)}`}
          sub="Available for trading"
          icon={Wallet} iconBg="#eff6ff" iconColor="#2563eb" trend={2.4}
        />
        <StatCard
          title="Asset Balance"
          value={`$${(user?.assetBalance ?? 0).toFixed(2)}`}
          sub={`Min: $${user?.minAssetRequired || 100}`}
          icon={Activity} iconBg="#ecfeff" iconColor="#0891b2"
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
        <StatCard
          title="Referral Code"
          value={user?.referralCode || '—'}
          sub="Share to earn"
          icon={Users} iconBg="#fefce8" iconColor="#b45309"
        />
      </div>

      {/* Binance Account Balance */}
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
            <p className="text-xs">No trades yet. {sub?.active ? 'Start the bot or place a manual trade.' : 'Subscribe to start trading.'}</p>
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
                    <div className="text-xs text-slate-400">{trade.source === 'manual' ? 'Manual' : 'Bot'}</div>
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
