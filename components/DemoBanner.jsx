'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FlaskConical, Wallet, RotateCcw, Rocket, RefreshCw, Gift } from 'lucide-react';

const money = (n) => `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const LABEL = { live: 'Live', demo: 'Demo', wallet: 'Wallet' };

/** Shared account actions. They reload the page so every view refetches in the new mode. */
export async function switchAccount(mode) {
  const msg = {
    live: 'Switch to LIVE trading with real funds?\n\nOpen virtual positions will be closed and the bot will stop. Start it again when you are ready.',
    demo: 'Switch to DEMO (free virtual $10,000)?\n\nOpen positions of the current virtual account are closed and the bot stops.',
    wallet: 'Switch to your WALLET (credits added by the admin)?\n\nOpen positions of the current virtual account are closed and the bot stops.',
  }[mode];
  if (!window.confirm(msg)) return;
  const res = await fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mode', mode }) });
  const d = await res.json();
  if (!res.ok) { window.alert(d.error || 'Could not switch'); return; }
  window.location.reload();
}

export async function resetDemo() {
  if (!window.confirm('Reset the demo account?\n\nAll demo trades are deleted and the balance goes back to $10,000.')) return;
  const res = await fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset' }) });
  if (!res.ok) { window.alert((await res.json()).error || 'Could not reset'); return; }
  window.location.reload();
}

function useAccount(pollMs = 0) {
  const [d, setD] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/demo').then(r => (r.ok ? r.json() : null)).then(x => { if (alive) setD(x); }).catch(() => {});
    load();
    const iv = pollMs ? setInterval(load, pollMs) : null;
    return () => { alive = false; if (iv) clearInterval(iv); };
  }, [pollMs]);
  return d;
}

/** Strip shown on every dashboard page while trading a virtual account (demo or wallet). */
export default function DemoBanner() {
  const d = useAccount(30_000);
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  if (!d) return null;

  // Not on the wallet but holding credits → nudge on the home page so users notice admin credits.
  if (d.mode !== 'wallet' && (d.wallet?.usdt ?? 0) >= 10 && pathname === '/dashboard') {
    return (
      <Link href="/dashboard/wallet"
        className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors hover:bg-violet-100/60"
        style={{ background: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.30)', color: '#6d28d9' }}>
        <Gift size={16} />
        <span>You have <strong className="font-mono">{money(d.wallet.usdt)}</strong> in wallet credits to trade with.</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">
          <Wallet size={12} /> Open Wallet
        </span>
      </Link>
    );
  }
  if (d.mode !== 'demo' && d.mode !== 'wallet') return null;

  const wallet = d.mode === 'wallet';
  const up = d.pnl >= 0;
  const tone = wallet
    ? { bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.35)', text: '#7c3aed' }
    : { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.35)', text: '#b45309' };
  const act = (fn) => async () => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-2.5 text-xs"
      style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}>
      <span className="flex items-center gap-1.5 font-bold uppercase tracking-wide">
        {wallet ? <Wallet size={14} /> : <FlaskConical size={14} />} {wallet ? 'Wallet credits' : 'Demo mode'}
      </span>
      <span>{wallet ? 'Admin-funded credits · real prices · not withdrawable' : 'Virtual funds · real prices · no real orders'}</span>
      <span className="font-mono font-semibold">Equity {money(d.equity)}</span>
      {(!wallet || d.startingBalance > 0) && (
        <span className="font-mono font-semibold" style={{ color: up ? '#16a34a' : '#dc2626' }}>
          {up ? '+' : '−'}{money(Math.abs(d.pnl))} ({up ? '+' : ''}{d.pnlPct.toFixed(2)}%)
        </span>
      )}
      <span>{d.openTrades} open · {d.closedTrades} closed{d.winRate != null ? ` · ${d.winRate.toFixed(0)}% wins` : ''}</span>
      {wallet && d.equity < 10 && <span className="font-semibold">No credits yet — ask the admin to fund your wallet</span>}
      <span className="ml-auto flex items-center gap-2">
        {!wallet && (
          <button onClick={act(resetDemo)} disabled={busy}
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1 font-semibold disabled:opacity-50"
            style={{ borderColor: tone.border }}>
            {busy ? <RefreshCw size={11} className="animate-spin" /> : <RotateCcw size={11} />} Reset
          </button>
        )}
        <button onClick={act(() => switchAccount('live'))} disabled={busy}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold text-white disabled:opacity-50"
          style={{ background: '#16a34a' }}>
          <Rocket size={11} /> Go Live
        </button>
      </span>
    </div>
  );
}

const STATUS_STYLE = {
  pending:  'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
};

/** Turn wallet-credit profit into real Asset Balance (admin approves each request). */
export function WalletPayoutPanel() {
  const [p, setP] = useState(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = () => fetch('/api/wallet/payout').then(r => (r.ok ? r.json() : null)).then(setP).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!p) return null;

  const amt = parseFloat(amount) || 0;
  async function request() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/wallet/payout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amt }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setMsg(`✓ Requested — ${money(d.payout.creditAmount)} goes to your Asset Balance once the admin approves`);
      setAmount('');
      await load();
    } catch (e) { setMsg(`✗ ${e.message}`); }
    setBusy(false);
  }

  return (
    <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span>Wallet profit available: <strong className="font-mono text-emerald-700">{money(p.profitAvailable)}</strong></span>
        <span className="text-slate-400">· paid out at {p.payoutPercent}% to Asset Balance · min {money(p.minPayout)} · admin approval</span>
      </div>
      {p.payoutPercent > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="number" min={p.minPayout} max={p.profitAvailable} step="0.01" value={amount}
            onChange={e => setAmount(e.target.value)} placeholder={`${p.minPayout} – ${p.profitAvailable}`}
            disabled={p.hasPending || p.profitAvailable < p.minPayout}
            className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-sm disabled:opacity-50" />
          <button onClick={() => setAmount(String(p.profitAvailable))} disabled={p.hasPending || p.profitAvailable < p.minPayout}
            className="text-xs font-semibold text-violet-600 disabled:opacity-40">Max</button>
          <button onClick={request} disabled={busy || p.hasPending || amt < p.minPayout || amt > p.profitAvailable}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40">
            {busy ? <RefreshCw size={11} className="animate-spin" /> : <Rocket size={11} />} Request payout
          </button>
          {amt > 0 && <span className="text-xs text-slate-500">you receive {money(Math.floor(amt * p.payoutPercent) / 100)}</span>}
          {p.hasPending && <span className="text-xs text-amber-600">A request is waiting for approval</span>}
        </div>
      )}
      {msg && <div className="mt-1.5 text-xs font-medium text-slate-600">{msg}</div>}
      {p.requests.length > 0 && (
        <ul className="mt-2 space-y-1">
          {p.requests.slice(0, 5).map(r => (
            <li key={r._id} className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="w-20 shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
              <span className="w-24 shrink-0 font-mono">{money(r.amount)} → {money(r.creditAmount)}</span>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[r.status]}`}>{r.status}</span>
              {r.note && <span className="truncate">{r.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Account switch (Demo | Wallet | Live) + wallet credits for the Settings page. */
export function AccountModeCard() {
  const d = useAccount();
  if (!d) return null;
  const colors = { demo: '#d97706', wallet: '#7c3aed', live: '#16a34a' };
  return (
    <div className="card glow-border mb-5 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-56 shrink-0">
          <div className="text-sm font-semibold text-slate-700">Account</div>
          <div className="text-xs text-slate-400 mt-0.5">Demo = free practice · Wallet = credits from admin · Live = your exchange</div>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {['demo', 'wallet', 'live'].map((val) => (
              <button key={val} onClick={() => (d.mode === val ? null : switchAccount(val))}
                className="px-4 py-1.5 rounded-md text-sm font-semibold transition-all"
                style={{
                  background: d.mode === val ? 'white' : 'transparent',
                  color: d.mode === val ? colors[val] : '#64748b',
                  boxShadow: d.mode === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                {LABEL[val]}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">
            {d.mode === 'live' && 'Real orders on your exchange via your API key'}
            {d.mode === 'demo' && <>Virtual equity <strong className="font-mono">{money(d.equity)}</strong> · no API key needed</>}
            {d.mode === 'wallet' && <>Wallet equity <strong className="font-mono">{money(d.equity)}</strong></>}
          </span>
          {d.mode === 'demo' && (
            <button onClick={resetDemo} className="btn-outline ml-auto flex items-center gap-1 py-1 px-3 text-xs">
              <RotateCcw size={11} /> Reset demo
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Wallet size={13} className="text-violet-500" />
          TrickyX Wallet Balance: <strong className="font-mono text-slate-700">{money(d.wallet?.usdt)}</strong>
          <span className="text-slate-400">· {money(d.wallet?.totalCredited)} credited in total · credits are not withdrawable, profit can be paid out</span>
        </div>
        {(d.wallet?.totalCredited > 0) && <WalletPayoutPanel />}
        {d.wallet?.credits?.length > 0 && (
          <ul className="mt-2 space-y-1">
            {d.wallet.credits.map((c) => (
              <li key={c._id} className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="w-20 shrink-0">{new Date(c.createdAt).toLocaleDateString()}</span>
                <span className={`w-20 shrink-0 font-mono font-semibold ${c.amount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {c.amount > 0 ? '+' : '−'}{money(Math.abs(c.amount))}
                </span>
                <span className="truncate">{c.note || (c.amount > 0 ? 'Credit from admin' : 'Debit by admin')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
