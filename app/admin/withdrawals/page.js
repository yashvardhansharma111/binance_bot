'use client';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight, RefreshCw, CheckCircle2, XCircle, Clock,
  ExternalLink, AlertCircle, Filter,
} from 'lucide-react';

const STATUS_STYLE = {
  pending:  { label: 'Pending',  color: '#b45309', bg: '#fefce8' },
  approved: { label: 'Approved', color: '#2563eb', bg: '#eff6ff' },
  paid:     { label: 'Paid',     color: '#16a34a', bg: '#f0fdf4' },
  rejected: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2' },
};

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('pending');
  const [processing,  setProcessing]  = useState('');
  const [txHash,      setTxHash]      = useState('');
  const [adminNote,   setAdminNote]   = useState('');
  const [activeId,    setActiveId]    = useState(null);
  const [error,       setError]       = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/withdrawals?status=${filter}`);
    const d   = await res.json();
    setWithdrawals(d.withdrawals || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  async function process(id, action) {
    setError(''); setProcessing(id);
    try {
      const res  = await fetch('/api/admin/withdrawals', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, action, txHash, adminNote }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error); return; }
      setActiveId(null); setTxHash(''); setAdminNote('');
      await load();
    } catch {
      setError('Network error');
    } finally {
      setProcessing('');
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <ArrowUpRight size={22} className="text-blue-500" /> Withdrawal Requests
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Review and process user withdrawal requests</p>
        </div>
        <button onClick={load} className="btn-outline py-2 px-3 flex items-center gap-1.5 text-xs">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl bg-slate-100 w-fit">
        {['pending','paid','rejected','all'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
            style={{
              background: filter === s ? '#0f172a' : 'transparent',
              color:      filter === s ? '#fff'     : '#64748b',
            }}>
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw size={20} className="animate-spin text-blue-500" />
        </div>
      ) : !withdrawals.length ? (
        <div className="card p-10 text-center text-slate-400">
          <Clock size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No {filter} withdrawal requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {withdrawals.map(w => {
            const s       = STATUS_STYLE[w.status] || STATUS_STYLE.pending;
            const isOpen  = activeId === w._id;
            const isPending = w.status === 'pending';

            return (
              <div key={w._id} className="card glow-border overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* User + amount */}
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {w.userId?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{w.userId?.name}</div>
                        <div className="text-xs text-slate-400">{w.userId?.email}</div>
                        <div className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2 flex-wrap">
                          ${w.amount.toFixed(2)}
                          <span className="text-sm font-normal text-slate-500">
                            {w.currency} {w.network && `· ${w.network}`}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: w.source === 'asset' ? '#eff6ff' : '#f0fdf4', color: w.source === 'asset' ? '#2563eb' : '#16a34a' }}>
                            {w.source === 'asset' ? 'Assets' : 'Referral'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                      {isPending && (
                        <button onClick={() => setActiveId(isOpen ? null : w._id)}
                          className="btn-outline py-1.5 px-3 text-xs">
                          {isOpen ? 'Cancel' : 'Process'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Wallet address */}
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono"
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <span className="text-slate-400 shrink-0">To:</span>
                    <span className="text-slate-700 break-all">{w.walletAddress}</span>
                  </div>

                  {/* TX hash (if paid) */}
                  {w.txHash && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                      <span className="text-emerald-700 font-mono break-all">TX: {w.txHash}</span>
                    </div>
                  )}
                  {w.adminNote && (
                    <div className="mt-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 bg-slate-50">
                      Note: {w.adminNote}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 mt-2">
                    Requested: {new Date(w.createdAt).toLocaleString()}
                    {w.processedAt && ` · Processed: ${new Date(w.processedAt).toLocaleString()}`}
                  </div>
                </div>

                {/* Process panel */}
                {isOpen && isPending && (
                  <div className="px-5 pb-5 pt-1 border-t border-slate-100 bg-slate-50 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        TX Hash <span className="text-slate-400 font-normal">(required for approve)</span>
                      </label>
                      <input type="text" placeholder="Transaction hash"
                        value={txHash} onChange={e => setTxHash(e.target.value)}
                        className="input text-xs font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Note (optional)</label>
                      <input type="text" placeholder="Note to user"
                        value={adminNote} onChange={e => setAdminNote(e.target.value)}
                        className="input text-xs" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => process(w._id, 'approve')}
                        disabled={!txHash || processing === w._id}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                        style={{ background: '#16a34a', color: '#fff' }}>
                        {processing === w._id
                          ? <RefreshCw size={14} className="animate-spin" />
                          : <CheckCircle2 size={14} />}
                        Mark as Paid
                      </button>
                      <button
                        onClick={() => process(w._id, 'reject')}
                        disabled={processing === w._id}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all"
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                        <XCircle size={14} /> Reject &amp; Refund
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
