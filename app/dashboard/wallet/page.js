'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, RefreshCw, Gift, TrendingUp, TrendingDown, Coins, CheckCircle2, Activity } from 'lucide-react';
import { switchAccount, WalletPayoutPanel } from '@/components/DemoBanner';

const money = (n) => `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

function Stat({ label, value, sub, tone = 'text-slate-900', Icon }) {
  return (
    <div className="card glow-border p-4">
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        {label} {Icon && <Icon size={14} className="text-violet-500" />}
      </div>
      <div className={`mt-1 font-mono text-xl font-bold ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function sideLabel(t) {
  if (t.market === 'futures') return `${t.positionSide || (t.side === 'BUY' ? 'LONG' : 'SHORT')}${t.leverage ? ` ${t.leverage}x` : ''}`;
  return t.side;
}

export default function WalletPage() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/demo?kind=wallet');
    setD(res.ok ? await res.json() : null);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading && !d) return (
    <div className="flex h-64 items-center justify-center"><RefreshCw size={22} className="animate-spin text-violet-500" /></div>
  );
  if (!d) return <p className="text-sm text-red-500">Could not load your wallet.</p>;

  const active = d.mode === 'wallet';
  const hasCredits = (d.totalCredited || 0) > 0;
  const up = d.pnl >= 0;
  // Opening records only — closing records repeat the same P&L.
  const trades = d.trades.filter(t => t.status === 'open' || (t.market === 'futures'
    ? (t.side === 'BUY') === ((t.positionSide || 'LONG') === 'LONG')
    : t.side === 'BUY'));

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 lg:text-2xl">
            <Wallet size={20} className="text-violet-500" /> Wallet
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 lg:text-sm">
            Trading credits added by the admin · real market prices · credits are not withdrawable, profit can be paid out
          </p>
        </div>
        <button onClick={load} className="btn-outline flex items-center gap-2 px-3 py-2 text-sm">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Status */}
      <div className={`mb-5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
        active ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
        {active ? (
          <>
            <CheckCircle2 size={16} />
            <span className="font-semibold">Wallet is active</span>
            <span>— the bot and your manual trades use these credits.</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold">
              <span className={`h-1.5 w-1.5 rounded-full ${d.botActive ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
              Bot {d.botActive ? 'running' : 'stopped'}
            </span>
            <Link href="/dashboard/bot" className="ml-auto inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700">
              <Activity size={12} /> {d.botActive ? 'Open Bot' : 'Start Bot'}
            </Link>
          </>
        ) : (
          <>
            <span>You are trading on <strong>{d.mode === 'demo' ? 'Demo' : 'Live'}</strong>.</span>
            <span className="text-slate-400">Switch to use your wallet credits.</span>
            <button
              onClick={async () => { setSwitching(true); try { await switchAccount('wallet'); } finally { setSwitching(false); } }}
              disabled={switching || d.usdt < 10}
              title={d.usdt < 10 ? 'You need at least $10 of credits' : ''}
              className="ml-auto inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40">
              <Wallet size={12} /> Trade with Wallet
            </button>
          </>
        )}
      </div>

      {!hasCredits ? (
        <div className="card glow-border px-6 py-14 text-center">
          <Gift size={36} className="mx-auto mb-3 text-violet-400" />
          <p className="font-semibold text-slate-700">No wallet credits yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            The admin adds credits for bonuses and contests. When you get some, they show up here and you can trade with them right away.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="TrickyX Wallet Balance" value={money(d.usdt)} sub="available to trade" Icon={Coins} />
            <Stat label="Equity" value={money(d.equity)} sub={`${d.openTrades} open position${d.openTrades === 1 ? '' : 's'}`} Icon={Wallet} />
            <Stat label="Profit / loss" value={`${up ? '+' : '−'}${money(Math.abs(d.pnl))}`}
              sub={`${up ? '+' : ''}${d.pnlPct.toFixed(2)}% on credits`} tone={up ? 'text-emerald-600' : 'text-red-500'}
              Icon={up ? TrendingUp : TrendingDown} />
            <Stat label="Credits received" value={money(d.totalCredited)}
              sub={d.totalDebited ? `${money(d.totalDebited)} deducted` : `${d.closedTrades} closed trade${d.closedTrades === 1 ? '' : 's'}`} Icon={Gift} />
          </div>

          {/* Payout of profit to Asset Balance */}
          <div className="card glow-border mb-5 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-800">Move profit to Asset Balance</h2>
            <p className="mt-0.5 text-xs text-slate-500">Only profit above your credits can be moved. Each request is approved by the admin.</p>
            <WalletPayoutPanel />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Credits history */}
            <div className="card glow-border p-5">
              <h2 className="mb-3 text-sm font-bold text-slate-800">Credits history</h2>
              <ul className="divide-y divide-slate-100">
                {d.credits.map(c => (
                  <li key={c._id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="break-words text-sm text-slate-700">{c.note || (c.amount > 0 ? 'Credit from admin' : 'Deducted by admin')}</div>
                      <div className="text-xs text-slate-400">{date(c.createdAt)}</div>
                    </div>
                    <span className={`shrink-0 font-mono text-sm font-semibold ${c.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {c.amount > 0 ? '+' : '−'}{money(Math.abs(c.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Wallet trades */}
            <div className="card glow-border p-5">
              <h2 className="mb-3 text-sm font-bold text-slate-800">Wallet trades</h2>
              {trades.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">No trades yet{active ? ' — start the bot or place a trade.' : '.'}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {trades.slice(0, 15).map(t => {
                    const pnl = t.profit || 0;
                    return (
                      <li key={t._id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-800">{t.symbol.replace('USDT', '')}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              sideLabel(t).startsWith('SHORT') ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>{sideLabel(t)}</span>
                          </div>
                          <div className="truncate text-xs text-slate-400">
                            @ {t.price?.toLocaleString(undefined, { maximumFractionDigits: 6 })} · {date(t.createdAt)}
                          </div>
                        </div>
                        {t.status === 'open'
                          ? <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">open</span>
                          : <span className={`shrink-0 font-mono text-sm font-semibold ${pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{pnl >= 0 ? '+' : '−'}{money(Math.abs(pnl))}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
