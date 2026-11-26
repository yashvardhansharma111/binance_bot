'use client';
import { useEffect, useState } from 'react';
import { FlaskConical, RotateCcw, Rocket, RefreshCw } from 'lucide-react';

const money = (n) => `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Shared demo-account actions. Both reload the page so every view refetches in the new mode. */
export async function switchAccount(mode) {
  const msg = mode === 'live'
    ? 'Switch to LIVE trading with real funds?\n\nOpen demo positions will be closed and the bot will stop. Start it again when you are ready.'
    : 'Switch to DEMO trading with virtual funds?\n\nThe bot will stop. Start it again to trade in demo.';
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

/** Strip shown on every dashboard page while the account is in demo mode. */
export default function DemoBanner() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/demo').then(r => (r.ok ? r.json() : null)).then(x => { if (alive) setD(x); }).catch(() => {});
    load();
    const iv = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  if (!d || d.mode !== 'demo') return null;
  const up = d.pnl >= 0;
  const act = (fn) => async () => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-2.5 text-xs"
      style={{ background: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.35)', color: '#b45309' }}>
      <span className="flex items-center gap-1.5 font-bold uppercase tracking-wide">
        <FlaskConical size={14} /> Demo mode
      </span>
      <span>Virtual funds · real prices · no real orders</span>
      <span className="font-mono font-semibold">Equity {money(d.equity)}</span>
      <span className="font-mono font-semibold" style={{ color: up ? '#16a34a' : '#dc2626' }}>
        {up ? '+' : '−'}{money(Math.abs(d.pnl))} ({up ? '+' : ''}{d.pnlPct.toFixed(2)}%)
      </span>
      <span>{d.openTrades} open · {d.closedTrades} closed{d.winRate != null ? ` · ${d.winRate.toFixed(0)}% wins` : ''}</span>
      <span className="ml-auto flex items-center gap-2">
        <button onClick={act(resetDemo)} disabled={busy}
          className="flex items-center gap-1 rounded-lg border px-2.5 py-1 font-semibold disabled:opacity-50"
          style={{ borderColor: 'rgba(245,158,11,0.45)' }}>
          {busy ? <RefreshCw size={11} className="animate-spin" /> : <RotateCcw size={11} />} Reset
        </button>
        <button onClick={act(() => switchAccount('live'))} disabled={busy}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold text-white disabled:opacity-50"
          style={{ background: '#16a34a' }}>
          <Rocket size={11} /> Go Live
        </button>
      </span>
    </div>
  );
}

/** Account mode switch for the Settings page. */
export function AccountModeCard() {
  const [d, setD] = useState(null);
  useEffect(() => { fetch('/api/demo').then(r => (r.ok ? r.json() : null)).then(setD).catch(() => {}); }, []);
  if (!d) return null;
  const demo = d.mode === 'demo';
  return (
    <div className="card glow-border mb-5 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-56 shrink-0">
          <div className="text-sm font-semibold text-slate-700">Account</div>
          <div className="text-xs text-slate-400 mt-0.5">Practise with virtual funds before trading real money</div>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {[['demo', 'Demo'], ['live', 'Live']].map(([val, label]) => (
              <button key={val} onClick={() => (d.mode === val ? null : switchAccount(val))}
                className="px-4 py-1.5 rounded-md text-sm font-semibold transition-all"
                style={{
                  background: d.mode === val ? 'white' : 'transparent',
                  color: d.mode === val ? (val === 'demo' ? '#d97706' : '#16a34a') : '#64748b',
                  boxShadow: d.mode === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">
            {demo
              ? <>Virtual equity <strong className="font-mono">{money(d.equity)}</strong> · no API key needed</>
              : 'Real orders on your exchange via your API key'}
          </span>
          {demo && (
            <button onClick={resetDemo} className="btn-outline ml-auto flex items-center gap-1 py-1 px-3 text-xs">
              <RotateCcw size={11} /> Reset demo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
