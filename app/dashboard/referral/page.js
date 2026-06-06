'use client';
import { useEffect, useState } from 'react';
import {
  Users, Copy, CheckCircle, DollarSign, UserCheck,
  RefreshCw, Link2, ArrowUpRight, Wallet, Clock,
  CheckCircle2, XCircle, AlertCircle, Send,
} from 'lucide-react';

const CURRENCIES = ['USDT TRC20', 'USDT BEP20'];

const STATUS_STYLE = {
  pending:  { label: 'Pending',  color: '#b45309', bg: '#fefce8', icon: Clock },
  approved: { label: 'Approved', color: '#2563eb', bg: '#eff6ff', icon: CheckCircle2 },
  paid:     { label: 'Paid',     color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2', icon: XCircle },
};

export default function ReferralPage() {
  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [copied,        setCopied]        = useState('');
  const [tab,           setTab]           = useState('overview');
  const [withdrawals,   setWithdrawals]   = useState([]);
  const [assetBalance,  setAssetBalance]  = useState(0);
  const [wAmount,       setWAmount]       = useState('');
  const [wAddress,      setWAddress]      = useState('');
  const [wCurrency,     setWCurrency]     = useState('USDT TRC20');
  const [wLoading,      setWLoading]      = useState(false);
  const [wError,        setWError]        = useState('');
  const [wSuccess,      setWSuccess]      = useState('');

  async function loadReferral() {
    const res = await fetch('/api/referral');
    const d   = await res.json();
    setData(d);
    setLoading(false);
  }

  async function loadWithdrawals() {
    const res = await fetch('/api/withdrawal');
    const d   = await res.json();
    setWithdrawals(d.withdrawals || []);
    setAssetBalance(d.assetBalance ?? 0);
  }

  useEffect(() => { loadReferral(); loadWithdrawals(); }, []);

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  async function submitWithdrawal(e) {
    e.preventDefault();
    setWError(''); setWSuccess('');
    setWLoading(true);
    try {
      const res  = await fetch('/api/withdrawal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          amount:        parseFloat(wAmount),
          walletAddress: wAddress,
          currency:      wCurrency === 'USDT TRC20' ? 'usdttrc20' : 'usdtbsc',
          network:       wCurrency === 'USDT TRC20' ? 'TRC20' : 'BEP20',
          source:        'asset',
        }),
      });
      const json = await res.json();
      if (!res.ok) { setWError(json.error); return; }
      setWSuccess(`Withdrawal request of $${wAmount} submitted! Admin will process within 24 hours.`);
      setWAmount(''); setWAddress('');
      await loadReferral();
      await loadWithdrawals();
    } catch {
      setWError('Network error. Try again.');
    } finally {
      setWLoading(false);
    }
  }

  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}/register?ref=${data?.referralCode}`
    : '';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={22} className="animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
  );

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Referral &amp; Earnings</h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-2)' }}>
          Earn 20% on subscriptions + 10% on every deposit from your referrals
        </p>
      </div>

      {/* Single asset balance card */}
      <div className="card glow-border p-5 flex items-center justify-between gap-3 mb-6"
        style={{ background: assetBalance > 0 ? 'var(--accent-dim)' : 'var(--surface)' }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-hover)' }}>
            <Wallet size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Asset Balance</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>${assetBalance.toFixed(2)}</div>
            <div className="text-xs" style={{ color: 'var(--text-3)' }}>Deposits · referral commissions · overpayments</div>
          </div>
        </div>
        {assetBalance >= 5
          ? <button onClick={() => setTab('withdraw')}
              className="btn-primary flex items-center gap-1.5 text-xs px-4 py-2.5 shrink-0">
              <ArrowUpRight size={13} /> Withdraw
            </button>
          : <span className="text-xs shrink-0" style={{ color: 'var(--text-3)' }}>Min $5 to withdraw</span>
        }
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'var(--surface-2)', width: 'fit-content' }}>
        {[['overview','Overview'],['withdraw','Withdraw'],['history','Withdrawal History']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === key ? 'var(--accent)' : 'transparent',
              color:      tab === key ? '#fff'          : 'var(--text-2)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Earned', value: `$${(data?.totalEarned || 0).toFixed(2)}`, sub: 'All time', icon: DollarSign, accent: true },
              { label: 'Total Referrals', value: data?.referrals?.length || 0, sub: 'Users you referred', icon: Users },
              { label: 'Active Bots', value: data?.referrals?.filter(r => r.botActive).length || 0, sub: 'Trading right now', icon: UserCheck },
            ].map(({ label, value, sub, icon: Icon, accent }) => (
              <div key={label} className="card p-5 glow-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--accent-dim)', border: '1px solid var(--border)' }}>
                    <Icon size={16} style={{ color: 'var(--accent)' }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{label}</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: accent ? 'var(--accent)' : 'var(--text-1)' }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Referral link */}
          <div className="card p-5 glow-border">
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
              <Link2 size={15} style={{ color: 'var(--accent)' }} /> Your Referral Details
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>Referral Code</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 input font-mono text-lg font-bold tracking-widest" style={{ color: 'var(--accent)' }}>
                    {data?.referralCode}
                  </div>
                  <button onClick={() => copy(data?.referralCode, 'code')} className="btn-outline py-2.5 px-3 flex items-center gap-1.5 text-xs shrink-0">
                    {copied === 'code' ? <CheckCircle size={13} /> : <Copy size={13} />}
                    {copied === 'code' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>Referral Link</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 input text-xs truncate" style={{ color: 'var(--text-2)' }}>{referralLink}</div>
                  <button onClick={() => copy(referralLink, 'link')} className="btn-primary py-2.5 px-3 flex items-center gap-1.5 text-xs shrink-0">
                    {copied === 'link' ? <CheckCircle size={13} /> : <Copy size={13} />}
                    {copied === 'link' ? 'Copied' : 'Copy Link'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="card p-5 glow-border">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-1)' }}>How You Earn</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { pct: '20%', label: 'of subscription price', desc: 'When your referral buys the bot ($49 plan → you get $9.80)' },
                { pct: '10%', label: 'of trade profit', desc: 'Every profitable trade your referral makes — you earn 10% of the 15% platform commission' },
              ].map(({ pct, label, desc }) => (
                <div key={label} className="rounded-xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div className="text-2xl font-bold mb-1" style={{ color: 'var(--accent)' }}>{pct}</div>
                  <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-1)' }}>{label}</div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Referrals list */}
            <div className="card p-5 glow-border">
              <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-1)' }}>
                Your Referrals ({data?.referrals?.length || 0})
              </h2>
              {!data?.referrals?.length ? (
                <div className="text-center py-8" style={{ color: 'var(--text-3)' }}>
                  <Users size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No referrals yet. Share your link!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {data.referrals.map(r => (
                    <div key={r._id} className="flex items-center justify-between py-2 px-3 rounded-lg transition-colors"
                      style={{ background: 'var(--surface-2)' }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: 'var(--accent)' }}>
                          {r.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{r.name}</div>
                          <div className="text-xs" style={{ color: 'var(--text-3)' }}>{new Date(r.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{
                            background: r.subscriptionExpiry && new Date(r.subscriptionExpiry) > new Date() ? 'rgba(37,99,235,0.1)' : 'var(--surface)',
                            color:      r.subscriptionExpiry && new Date(r.subscriptionExpiry) > new Date() ? '#2563eb' : 'var(--text-3)',
                          }}>
                          {r.subscriptionExpiry && new Date(r.subscriptionExpiry) > new Date() ? 'Subscribed' : 'No Sub'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{
                            background: r.botActive ? 'rgba(34,197,94,0.1)' : 'var(--surface)',
                            color:      r.botActive ? '#16a34a' : 'var(--text-3)',
                          }}>
                          {r.botActive ? 'Trading' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commission history */}
            <div className="card p-5 glow-border">
              <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-1)' }}>Commission History</h2>
              {!data?.commissions?.length ? (
                <div className="text-center py-8" style={{ color: 'var(--text-3)' }}>
                  <DollarSign size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Commissions appear here as your referrals trade.</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {data.commissions.map(c => (
                    <div key={c._id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="text-xs font-semibold capitalize" style={{ color: 'var(--text-1)' }}>
                          {c.type} commission
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                          {new Date(c.createdAt).toLocaleDateString()}&nbsp;
                          {new Date(c.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <span className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
                        +${(c.amount || 0).toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── WITHDRAW ─────────────────────────────────────────────────── */}
      {tab === 'withdraw' && (
        <div className="max-w-lg">
          <div className="card p-6 glow-border">
            <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-1)' }}>Request Withdrawal</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-2)' }}>
              Admin processes within 24 hours. Minimum $5.
            </p>

            {/* Balance info */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-4"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Available Asset Balance</span>
              <span className="text-base font-bold" style={{ color: 'var(--accent)' }}>${assetBalance.toFixed(2)}</span>
            </div>

            {(() => {
              const activeBal = assetBalance;
              return (
            <>
            {wSuccess ? (
              <div className="flex items-start gap-3 p-4 rounded-xl mb-4"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <CheckCircle2 size={18} style={{ color: '#16a34a' }} className="shrink-0 mt-0.5" />
                <p className="text-sm" style={{ color: '#16a34a' }}>{wSuccess}</p>
              </div>
            ) : (
              <form onSubmit={submitWithdrawal} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>Amount (USD)</label>
                  <input type="number" min="5" step="0.01" placeholder="e.g. 10.00"
                    value={wAmount} onChange={e => setWAmount(e.target.value)}
                    className="input" required />
                  {wAmount && parseFloat(wAmount) > activeBal && (
                    <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Exceeds available balance (${activeBal.toFixed(2)})</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>Network</label>
                  <div className="flex gap-2">
                    {CURRENCIES.map(c => (
                      <button key={c} type="button" onClick={() => setWCurrency(c)}
                        className="flex-1 py-2 rounded-lg border text-xs font-semibold transition-all"
                        style={{
                          background:  wCurrency === c ? 'var(--accent-dim)' : 'var(--surface-2)',
                          borderColor: wCurrency === c ? 'var(--accent)' : 'var(--border)',
                          color:       wCurrency === c ? 'var(--accent)' : 'var(--text-2)',
                        }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)' }}>Wallet Address</label>
                  <input type="text" placeholder="Your wallet address"
                    value={wAddress} onChange={e => setWAddress(e.target.value)}
                    className="input font-mono text-xs" required />
                </div>

                {wError && (
                  <div className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg"
                    style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
                    <AlertCircle size={14} className="shrink-0" /> {wError}
                  </div>
                )}

                <button type="submit" disabled={wLoading || !wAmount || parseFloat(wAmount) > activeBal}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
                  {wLoading ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                  {wLoading ? 'Submitting...' : 'Submit Withdrawal Request'}
                </button>

                <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
                  Funds are held immediately. If rejected, they are returned to your balance.
                </p>
              </form>
            )}

            {wSuccess && (
              <button onClick={() => { setWSuccess(''); setTab('history'); }}
                className="btn-outline w-full mt-3 py-2.5 text-sm">
                View Withdrawal History
              </button>
            )}
            </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── WITHDRAWAL HISTORY ───────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="card glow-border overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Withdrawal History</h2>
          </div>
          {!withdrawals.length ? (
            <div className="text-center py-12" style={{ color: 'var(--text-3)' }}>
              <ArrowUpRight size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No withdrawal requests yet.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {withdrawals.map(w => {
                const s = STATUS_STYLE[w.status] || STATUS_STYLE.pending;
                const Icon = s.icon;
                return (
                  <div key={w._id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: s.bg }}>
                          <Icon size={16} style={{ color: s.color }} />
                        </div>
                        <div>
                          <div className="text-sm font-bold flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-1)' }}>
                            ${w.amount.toFixed(2)}
                            <span className="font-normal text-xs" style={{ color: 'var(--text-2)' }}>{w.currency} {w.network && `· ${w.network}`}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: '#eff6ff', color: '#2563eb' }}>
                              Assets
                            </span>
                          </div>
                          <div className="text-xs font-mono mt-0.5 truncate max-w-xs" style={{ color: 'var(--text-3)' }}>
                            {w.walletAddress}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                            {new Date(w.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold shrink-0"
                        style={{ background: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                    </div>
                    {w.txHash && (
                      <div className="mt-2 ml-12 text-xs font-mono px-3 py-1.5 rounded-lg"
                        style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}>
                        TX: {w.txHash}
                      </div>
                    )}
                    {w.adminNote && (
                      <div className="mt-1 ml-12 text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                        Note: {w.adminNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
