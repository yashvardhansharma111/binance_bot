'use client';
import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { useSession } from 'next-auth/react';
import {
  Wallet, Copy, CheckCircle2, Clock, XCircle,
  RefreshCw, ChevronDown, ArrowDownToLine,
} from 'lucide-react';

const CURRENCIES = [
  {
    value:       'usdttrc20',
    label:       'USDT TRC20',
    network:     'Tron Network',
    tag:         'TRC20',
    fee:         'Fee ~$1',
    accentColor: '#EF0027',
    bgSelected:  '#fff1f2',
    borderSel:   '#EF0027',
    warning:     'Send only USDT on Tron (TRC20). Do NOT send TRX or any other coin — it will be lost.',
    Logo: () => (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="18" fill="#EF0027"/>
        <polygon points="18,8 28,14 28,24 18,30 8,24 8,14" fill="none" stroke="white" strokeWidth="1.5"/>
        <text x="18" y="23" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="sans-serif">TRX</text>
      </svg>
    ),
  },
  {
    value:       'usdtbsc',
    label:       'USDT BEP20',
    network:     'BNB Smart Chain',
    tag:         'BEP20',
    fee:         'Fee ~$0.8',
    accentColor: '#F0B90B',
    bgSelected:  '#fffbeb',
    borderSel:   '#F0B90B',
    warning:     'Send only USDT on BNB Smart Chain (BEP20). Do NOT send BNB or any other coin — it will be lost.',
    Logo: () => (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="18" fill="#F0B90B"/>
        <text x="18" y="22" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="sans-serif">BNB</text>
      </svg>
    ),
  },
];

const AMOUNTS = [10, 25, 50, 100, 250, 500];

const STATUS_META = {
  waiting:        { label: 'Waiting for payment',  color: '#b45309', bg: '#fefce8', icon: Clock },
  confirming:     { label: 'Confirming on-chain',  color: '#2563eb', bg: '#eff6ff', icon: RefreshCw },
  confirmed:      { label: 'Confirmed',             color: '#2563eb', bg: '#eff6ff', icon: RefreshCw },
  sending:        { label: 'Sending funds',         color: '#7c3aed', bg: '#f5f3ff', icon: RefreshCw },
  partially_paid: { label: 'Partial payment received — funds credited to wallet!', color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle2 },
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
  const [payment,   setPayment]   = useState(null);   // { paymentId, payAddress, payAmount, payCurrency, gasFee, status }
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
      if (['finished','partially_paid','failed','expired','refunded'].includes(data.status)) {
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
  const currObj  = CURRENCIES.find(c => c.value === currency) || CURRENCIES[0];
  const payObj   = payment ? (CURRENCIES.find(c => c.value === payment.payCurrency) || currObj) : null;

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
            <label className="block text-sm font-semibold text-slate-700 mb-3">Select Network</label>
            <div className="flex gap-3 mb-3">
              {CURRENCIES.map(c => {
                const selected = currency === c.value;
                return (
                  <button key={c.value} onClick={() => setCurrency(c.value)}
                    className="flex-1 text-left rounded-xl border-2 p-3.5 transition-all"
                    style={{
                      background:  selected ? c.bgSelected : '#f8fafc',
                      borderColor: selected ? c.borderSel  : '#e2e8f0',
                    }}>
                    <div className="flex items-start gap-3">
                      <c.Logo />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-slate-800">{c.label}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: c.accentColor + '20', color: c.accentColor }}>
                            {c.tag}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{c.network}</div>
                        <div className="text-xs font-medium mt-1" style={{ color: c.accentColor }}>{c.fee}</div>
                      </div>
                      {selected && (
                        <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                          style={{ background: c.accentColor }}>
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Warning banner */}
            {currObj && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border"
                style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5">
                  <path d="M8 1.5L14.5 13H1.5L8 1.5Z" fill="#f97316" stroke="#ea580c" strokeWidth="0.5"/>
                  <path d="M8 6v3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11.5" r="0.75" fill="white"/>
                </svg>
                <div>
                  <p className="text-xs font-bold text-orange-700 mb-0.5">Wrong coin = permanent loss</p>
                  <p className="text-xs text-orange-600 leading-relaxed">{currObj.warning}</p>
                </div>
              </div>
            )}
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

              {/* Network badge */}
              {payObj && (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border"
                  style={{ background: payObj.bgSelected, borderColor: payObj.borderSel + '80' }}>
                  <payObj.Logo />
                  <div>
                    <div className="text-xs font-bold" style={{ color: payObj.accentColor }}>{payObj.label}</div>
                    <div className="text-xs text-slate-500">{payObj.network} · {payObj.tag}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Network</div>
                    <div className="text-xs font-bold px-2 py-0.5 rounded-full mt-0.5"
                      style={{ background: payObj.accentColor, color: '#fff' }}>{payObj.tag}</div>
                  </div>
                </div>
              )}

              <div className="text-center">
                <div className="text-xs text-slate-400 mb-1">Send exactly</div>
                <div className="text-3xl font-bold text-slate-900">
                  {payment.payAmount} <span style={{ color: payObj?.accentColor || '#2563eb' }}>{payment.payCurrency?.toUpperCase()}</span>
                </div>
                <div className="text-sm text-slate-400 mt-0.5">
                  ${finalAmt} deposit
                  {payment.gasFee > 0 && (
                    <span className="ml-1 text-amber-600 font-medium">+ ${payment.gasFee} network fee</span>
                  )}
                </div>
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

              {/* Critical warning on payment screen */}
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border"
                style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5">
                  <circle cx="8" cy="8" r="7" fill="#dc2626" stroke="#b91c1c" strokeWidth="0.5"/>
                  <path d="M8 5v3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11" r="0.75" fill="white"/>
                </svg>
                <div>
                  <p className="text-xs font-bold text-red-700 mb-0.5">Send only USDT on {payObj?.tag || 'this network'}</p>
                  <p className="text-xs text-red-600 leading-relaxed">
                    {payObj?.warning || 'Sending any other coin or using the wrong network will result in permanent loss of funds.'}
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-400 text-center">
                Send the exact amount shown above. A different amount may delay crediting.
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
