'use client';
import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { Crown, CheckCircle2, Clock, XCircle, RefreshCw, Copy, Zap } from 'lucide-react';

const CURRENCIES = [
  { value: 'usdttrc20', label: 'USDT TRC20', sub: 'Tron (TRC20)' },
  { value: 'usdtbsc',   label: 'USDT BEP20', sub: 'BNB Smart Chain' },
];

const STATUS_META = {
  waiting:    { label: 'Waiting for payment',  color: '#b45309', bg: '#fefce8', icon: Clock },
  confirming: { label: 'Confirming on-chain',  color: '#2563eb', bg: '#eff6ff', icon: RefreshCw },
  confirmed:  { label: 'Confirmed',             color: '#2563eb', bg: '#eff6ff', icon: RefreshCw },
  sending:    { label: 'Sending',               color: '#7c3aed', bg: '#f5f3ff', icon: RefreshCw },
  finished:   { label: 'Subscription Active!', color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle2 },
  failed:     { label: 'Payment failed',        color: '#dc2626', bg: '#fef2f2', icon: XCircle },
  expired:    { label: 'Payment expired',       color: '#dc2626', bg: '#fef2f2', icon: XCircle },
};

export default function SubscribePage() {
  const [currency, setCurrency]  = useState('usdttrc20');
  const [sub,      setSub]       = useState(null);
  const [status,   setStatus]    = useState(null);
  const [expiry,   setExpiry]    = useState(null);
  const [loading,  setLoading]   = useState(true);
  const [creating, setCreating]  = useState(false);
  const [copied,   setCopied]    = useState(false);
  const [copiedAmt,setCopiedAmt] = useState(false);
  const [error,    setError]     = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    checkStatus();
    return () => clearInterval(pollRef.current);
  }, []);

  async function checkStatus() {
    const res  = await fetch('/api/subscription');
    const data = await res.json();
    setLoading(false);
    if (data.active) { setExpiry(data.expiry); return; }
    if (data.pending) {
      setSub(data.pending);
      setStatus(data.pending.status);
      startPolling();
    }
  }

  function startPolling() {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res  = await fetch('/api/subscription');
      const data = await res.json();
      if (data.active) {
        setExpiry(data.expiry);
        setStatus('finished');
        clearInterval(pollRef.current);
        return;
      }
      if (data.pending) setStatus(data.pending.status);
      if (['failed','expired','refunded'].includes(data.pending?.status)) {
        clearInterval(pollRef.current);
      }
    }, 8000);
  }

  async function subscribe() {
    setError(''); setCreating(true);
    const res  = await fetch('/api/subscription/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setError(data.error || 'Failed to create payment'); return; }
    setSub(data);
    setStatus(data.status);
    startPolling();
  }

  function copy(text, setter) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true); setTimeout(() => setter(false), 2000);
    });
  }

  const meta = status ? (STATUS_META[status] || STATUS_META.waiting) : null;
  const StatusIcon = meta?.icon;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={22} className="text-blue-500 animate-spin" />
    </div>
  );

  // Already subscribed
  if (expiry && new Date(expiry) > new Date()) {
    const daysLeft = Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
    return (
      <div className="max-w-md mx-auto text-center pt-8">
        <div className="card p-8 glow-border">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Crown size={28} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Subscription Active</h2>
          <p className="text-slate-500 text-sm mb-4">Your bot subscription is active and running.</p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-700 text-sm font-semibold">
            <CheckCircle2 size={14} className="inline mr-1.5" />
            {daysLeft} days remaining &bull; Expires {new Date(expiry).toLocaleDateString()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-slate-900 lg:text-2xl flex items-center justify-center gap-2">
          <Crown size={20} className="text-blue-500" /> Subscribe to Bot
        </h1>
        <p className="text-slate-500 mt-1 text-sm">Unlock AI-powered automated trading</p>
      </div>

      {/* Plan card */}
      <div className="card glow-border p-6 mb-5 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-3">
          <Zap size={20} className="text-white" />
        </div>
        <div className="text-3xl font-bold text-slate-900 mb-0.5">$49 <span className="text-lg text-slate-400 font-normal">USDT</span></div>
        <div className="text-sm text-slate-500 mb-4">6 months access — $8.17/mo</div>
        <ul className="text-sm text-slate-600 space-y-1.5 text-left mb-4 pl-2">
          {['24/7 AI bot running on Binance','RSI + MACD + Groq sentiment signals','Auto stop-loss & take-profit','Manual trading panel','Real-time chart & bot monitor'].map(f => (
            <li key={f} className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> {f}
            </li>
          ))}
        </ul>
      </div>

      {!sub || ['failed','expired'].includes(status) ? (
        /* Currency select + pay button */
        <div className="card glow-border p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Network</label>
            <div className="flex gap-3">
              {CURRENCIES.map(c => (
                <button key={c.value} onClick={() => setCurrency(c.value)}
                  className="flex-1 flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all"
                  style={{
                    background:  currency === c.value ? '#eff6ff' : '#f8fafc',
                    borderColor: currency === c.value ? '#2563eb' : '#e2e8f0',
                  }}>
                  <div>
                    <div className="text-sm font-bold text-slate-800">{c.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{c.sub}</div>
                  </div>
                  {currency === c.value && <CheckCircle2 size={15} className="text-blue-500 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
          )}

          <button onClick={subscribe} disabled={creating}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            {creating ? <RefreshCw size={15} className="animate-spin" /> : <Crown size={15} />}
            {creating ? 'Generating address...' : 'Subscribe Now — $49 USDT'}
          </button>
        </div>

      ) : (
        /* Payment details */
        <div className="space-y-3">
          {meta && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium"
              style={{ background: meta.bg, borderColor: meta.color + '40', color: meta.color }}>
              <StatusIcon size={15} className={['confirming','confirmed','sending'].includes(status) ? 'animate-spin' : ''} />
              {meta.label}
              {status !== 'finished' && <span className="ml-auto text-xs opacity-60">Polling every 8s</span>}
            </div>
          )}

          {status !== 'finished' && sub?.payAddress && (
            <div className="card glow-border p-5 space-y-4">
              <div className="text-center">
                <div className="text-xs text-slate-400 mb-1">Send exactly</div>
                <div className="text-2xl font-bold text-slate-900">
                  {sub.payAmount} <span className="text-blue-500">{sub.payCurrency?.toUpperCase()}</span>
                </div>
              </div>
              <div className="flex justify-center p-3 bg-white border border-slate-100 rounded-xl">
                <QRCode value={sub.payAddress} size={160} />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Address</div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <span className="flex-1 text-xs font-mono text-slate-700 break-all">{sub.payAddress}</span>
                  <button onClick={() => copy(sub.payAddress, setCopied)} className="shrink-0 p-1 rounded hover:bg-slate-100">
                    {copied ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} className="text-slate-400" />}
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Amount</div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <span className="flex-1 text-xs font-mono text-slate-700">{sub.payAmount} {sub.payCurrency?.toUpperCase()}</span>
                  <button onClick={() => copy(String(sub.payAmount), setCopiedAmt)} className="shrink-0 p-1 rounded hover:bg-slate-100">
                    {copiedAmt ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} className="text-slate-400" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
