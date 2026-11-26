'use client';
import { useEffect, useState } from 'react';
import { FlaskConical, Wallet, RotateCcw, Rocket, RefreshCw } from 'lucide-react';

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
  if (!d || (d.mode !== 'demo' && d.mode !== 'wallet')) return null;

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
          Wallet credits: <strong className="font-mono text-slate-700">{money(d.wallet?.usdt)}</strong> free
          <span className="text-slate-400">· {money(d.wallet?.totalCredited)} credited in total · not withdrawable</span>
        </div>
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
