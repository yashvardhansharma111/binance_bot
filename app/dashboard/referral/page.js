'use client';
import { useEffect, useState } from 'react';
import { Users, Copy, CheckCircle, DollarSign, UserCheck, RefreshCw, Link2 } from 'lucide-react';

export default function ReferralPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    fetch('/api/referral').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}/register?ref=${data?.referralCode}`
    : '';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={22} className="text-blue-500 animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Referral Program</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Earn commissions on every trade made by your referrals</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="card p-6 glow-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <DollarSign size={18} className="text-blue-600" />
            </div>
            <span className="text-slate-500 text-sm font-medium">Total Earned</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">${(data?.totalEarned || 0).toFixed(2)}</div>
          <div className="text-xs text-slate-400 mt-1">All time commissions</div>
        </div>
        <div className="card p-6 glow-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center">
              <Users size={18} className="text-cyan-600" />
            </div>
            <span className="text-slate-500 text-sm font-medium">Total Referrals</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{data?.referrals?.length || 0}</div>
          <div className="text-xs text-slate-400 mt-1">Users you referred</div>
        </div>
        <div className="card p-6 glow-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <UserCheck size={18} className="text-emerald-600" />
            </div>
            <span className="text-slate-500 text-sm font-medium">Active Bots</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {data?.referrals?.filter(r => r.botActive).length || 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">Referrals trading now</div>
        </div>
      </div>

      {/* Referral link */}
      <div className="card p-6 glow-border mb-6">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Link2 size={16} className="text-blue-500" /> Your Referral Details
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Referral Code</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 input font-mono text-blue-600 text-base tracking-widest font-bold">
                {data?.referralCode}
              </div>
              <button onClick={() => copy(data?.referralCode, 'code')}
                className="btn-outline py-2.5 px-4 flex items-center gap-2 text-sm shrink-0">
                {copied === 'code' ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copied === 'code' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Referral Link</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 input text-sm text-slate-600 truncate">{referralLink}</div>
              <button onClick={() => copy(referralLink, 'link')}
                className="btn-primary py-2.5 px-4 flex items-center gap-2 text-sm shrink-0">
                {copied === 'link' ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied === 'link' ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Referrals list */}
        <div className="card p-6 glow-border">
          <h2 className="text-base font-bold text-slate-900 mb-4">Your Referrals ({data?.referrals?.length || 0})</h2>
          {data?.referrals?.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Users size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No referrals yet. Share your link!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.referrals.map(r => (
                <div key={r._id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-600">
                      {r.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{r.name}</div>
                      <div className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    r.botActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>{r.botActive ? 'Trading' : 'Inactive'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commission history */}
        <div className="card p-6 glow-border">
          <h2 className="text-base font-bold text-slate-900 mb-4">Commission History</h2>
          {data?.commissions?.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <DollarSign size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Commissions appear here as your referrals trade.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.commissions.map(c => (
                <div key={c._id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800 capitalize">{c.type} commission</div>
                    <div className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span className="text-emerald-600 font-bold text-sm">+${c.amount.toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
