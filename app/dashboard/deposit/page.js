'use client';
import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { useSession } from 'next-auth/react';
import {
  Wallet, Copy, CheckCircle2, Clock, XCircle,
  RefreshCw, ChevronDown, ArrowDownToLine,
} from 'lucide-react';

const CURRENCIES = [
  { value: 'usdttrc20', label: 'USDT TRC20', symbol: 'USDT', network: 'Tron (TRC20)' },
  { value: 'usdtbsc',   label: 'USDT BEP20', symbol: 'USDT', network: 'BNB Smart Chain (BEP20)' },
];

const AMOUNTS = [10, 25, 50, 100, 250, 500];

const STATUS_META = {
  waiting:        { label: 'Waiting for payment',  color: '#b45309', bg: '#fefce8', icon: Clock },
  confirming:     { label: 'Confirming on-chain',  color: '#2563eb', bg: '#eff6ff', icon: RefreshCw },
  confirmed:      { label: 'Confirmed',             color: '#2563eb', bg: '#eff6ff', icon: RefreshCw },
  sending:        { label: 'Sending funds',         color: '#7c3aed', bg: '#f5f3ff', icon: RefreshCw },
  partially_paid: { label: 'Partially paid',        color: '#b45309', bg: '#fefce8', icon: Clock },
  finished:       { label: 'Payment complete!',     color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle2 },
  failed:         { label: 'Payment failed',        color: '#dc2626', bg: '#fef2f2', icon: XCircle },
  expired:        { label: 'Payment expired',       color: '#dc2626', bg: '#fef2f2', icon: XCircle },
  refunded:       { label: 'Refunded',              color: '#64748b', bg: '#f8fafc', icon: CheckCircle2 },
};

export default function DepositPage() {
  const { data: session } = useSession();
  const [amount,    setAmount]    = useState(50);
  const [currency,  setCurrency]  = useState('usdttrc20');
  const [custom,    setCustom]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [payment,   setPayment]   = useState(null);   // { paymentId, payAddress, payAmount, payCurrency, status }
  const [status,    setStatus]    = useState(null);
  const [balance,   setBalance]   = useState(null);
  const [copied,    setCopied]    = useState(false);
  const [copiedAmt, setCopiedAmt] = useState(false);
  const [error,     setError]     = useState('');
  const pollRef = useRef(null);

  const finalAmt = custom ? parseFloat(custom) : amount;

  async function createPayment() {
    setError('');
    if (!finalAmt || finalAmt < 1) { setError('Minimum deposit is $1'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalAmt, currency }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create payment'); return; }
      setPayment(data);
      setStatus(data.status);
      startPolling(data.paymentId);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function startPolling(id) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res  = await fetch(`/api/payments/${id}`);
      const data = await res.json();
      setStatus(data.status);
      if (data.assetBalance !== undefined) setBalance(data.assetBalance);
      if (['finished','failed','expired','refunded'].includes(data.status)) {
        clearInterval(pollRef.current);
      }
    }, 8000);
  }

  useEffect(() => () => clearInterval(pollRef.current), []);

  function copy(text, setter) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  }

  function reset() {
    clearInterval(pollRef.current);
    setPayment(null);
    setStatus(null);
    setError('');
  }

  const meta = status ? (STATUS_META[status] || STATUS_META.waiting) : null;
  const StatusIcon = meta?.icon;
  const isDone  = status === 'finished';
  const isFail  = ['failed','expired'].includes(status);
  const currObj = CURRENCIES.find(c => c.value === currency) || CURRENCIES[0];

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <ArrowDownToLine size={22} className="text-blue-500" />
            Deposit Funds
          </h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Add USD balance to your trading account via crypto
          </p>
        </div>
        {balance !== null && (
          <div className="text-right">
            <div className="text-xs text-slate-400">Asset Balance</div>
            <div className="text-xl font-bold text-slate-900">
              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}
      </div>

      {!payment ? (
        /* ── Step 1: Select amount + currency ── */
        <div className="card glow-border p-6 space-y-6">
          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Deposit Amount (USD)</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {AMOUNTS.map(a => (
                <button key={a} onClick={() => { setAmount(a); setCustom(''); }}
                  className="py-2.5 rounded-lg text-sm font-bold border transition-all"
                  style={{
                    background:   !custom && amount === a ? '#2563eb' : '#f8fafc',
                    color:        !custom && amount === a ? '#fff'    : '#64748b',
                    borderColor:  !custom && amount === a ? '#2563eb' : '#e2e8f0',
                  }}>
                  ${a}
                </button>
              ))}
            </div>
            <input
              type="number" min="1" placeholder="Custom amount…"
              value={custom}
              onChange={e => { setCustom(e.target.value); setAmount(0); }}
              className="input w-full"
            />
          </div>

          {/* Network */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Network</label>
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
                    <div className="text-xs text-slate-400 mt-0.5">{c.network}</div>
                  </div>
                  {currency === c.value && <CheckCircle2 size={16} className="text-blue-500 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
          )}

          <button onClick={createPayment} disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            {loading
              ? <><RefreshCw size={16} className="animate-spin" /> Generating address…</>
              : <><Wallet size={16} /> Generate Payment Address</>}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Powered by NOWPayments sandbox &bull; Funds credited after 1 confirmation
          </p>
        </div>

      ) : (
        /* ── Step 2: Payment details + QR ── */
        <div className="space-y-4">
          {/* Status banner */}
          {meta && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border font-medium text-sm"
              style={{ background: meta.bg, borderColor: meta.color + '40', color: meta.color }}>
              <StatusIcon size={16} className={['confirming','confirmed','sending'].includes(status) ? 'animate-spin' : ''} />
              {meta.label}
              {!isDone && !isFail && (
                <span className="ml-auto text-xs opacity-60">Auto-refreshing every 8s</span>
              )}
            </div>
          )}

          {isDone && (
            <div className="card p-5 text-center space-y-2">
              <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
              <div className="text-lg font-bold text-slate-900">Deposit Confirmed!</div>
              <div className="text-slate-500 text-sm">
                ${(finalAmt * 0.85).toFixed(2)} has been added to your asset balance
                <span className="block text-xs text-slate-400 mt-0.5">(after 15% platform commission)</span>
              </div>
              {balance !== null && (
                <div className="text-2xl font-bold text-emerald-600">
                  ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              )}
              <button onClick={reset} className="btn-outline mt-3 px-6 py-2 text-sm">
                Make Another Deposit
              </button>
            </div>
          )}

          {!isDone && (
            <div className="card glow-border p-6 space-y-5">
              <div className="text-center">
                <div className="text-xs text-slate-400 mb-1">Send exactly</div>
                <div className="text-3xl font-bold text-slate-900">
                  {payment.payAmount} <span className="text-blue-500">{payment.payCurrency?.toUpperCase()}</span>
                </div>
                <div className="text-sm text-slate-400 mt-0.5">≈ ${finalAmt} USD</div>
              </div>

              {/* QR */}
              <div className="flex justify-center p-4 bg-white border border-slate-100 rounded-xl">
                <QRCode value={payment.payAddress} size={180} />
              </div>

              {/* Address */}
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Payment Address</div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                  <span className="flex-1 text-xs font-mono text-slate-700 break-all">{payment.payAddress}</span>
                  <button onClick={() => copy(payment.payAddress, setCopied)}
                    className="shrink-0 p-1.5 rounded hover:bg-slate-100 transition-colors">
                    {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} className="text-slate-400" />}
                  </button>
                </div>
              </div>

              {/* Amount copy */}
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Exact Amount</div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                  <span className="flex-1 text-xs font-mono text-slate-700">{payment.payAmount} {payment.payCurrency?.toUpperCase()}</span>
                  <button onClick={() => copy(String(payment.payAmount), setCopiedAmt)}
                    className="shrink-0 p-1.5 rounded hover:bg-slate-100 transition-colors">
                    {copiedAmt ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} className="text-slate-400" />}
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-400 text-center">
                Send the exact amount to the address above. Sending a different amount may delay crediting.
              </div>

              {isFail && (
                <button onClick={reset} className="btn-outline w-full py-2.5 text-sm">
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
