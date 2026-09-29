'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Users, Activity, BarChart2, TrendingUp, TrendingDown,
  DollarSign, RefreshCw, Globe, ShieldOff,
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, accent = '#3b82f6' }) {
  return (
    <div className="card glow-border p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: accent + '18' }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{value}</div>
        <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-3)' }}>{label}</div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { data: session } = useSession();
  const [stats,   setStats]  = useState(null);
  const [loading, setLoad]   = useState(true);
  const [denied,  setDenied] = useState(false);

  const isAdmin = session?.user?.role === 'admin';
  const perms   = session?.user?.overviewPermissions ?? [];
  const can     = (section) => isAdmin || perms.includes(section);

  async function load() {
    setLoad(true);
    const res = await fetch('/api/admin/stats');
    if (res.status === 403) { setDenied(true); setLoad(false); return; }
    const data = await res.json();
    setStats(data);
    setLoad(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={24} className="animate-spin text-blue-500" />
    </div>
  );

  if (denied) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <ShieldOff size={40} className="text-slate-300" />
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>Access Restricted</h2>
      <p className="text-sm text-center max-w-xs" style={{ color: 'var(--text-3)' }}>
        You don&apos;t have permission to view the platform overview.
        Contact an administrator to request access.
      </p>
    </div>
  );

  if (!stats) return null;

  const recentTrades = stats.recentTrades || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
            <Globe size={22} className="text-blue-500" /> Platform Overview
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>Live platform statistics</p>
        </div>
        <button onClick={load} className="btn-outline py-2 px-4 flex items-center gap-2 text-sm">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* User stats */}
      {can('users') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={Users}    label="Total Users"  value={stats.totalUsers}  accent="#3b82f6" />
          <StatCard icon={Activity} label="Active Users" value={stats.activeUsers} accent="#10b981" />
          <StatCard icon={Activity} label="Active Bots"  value={stats.activeBots}  accent="#8b5cf6" />
          <StatCard icon={Users}    label="Active Subs"  value={stats.activeSubs}  accent="#f59e0b" />
        </div>
      )}

      {/* Trading stats */}
      {can('trading') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={BarChart2}  label="Total Trades"     value={stats.totalTrades}   accent="#64748b" />
          <StatCard icon={BarChart2}  label="Closed Trades"    value={stats.closedTrades}  accent="#64748b" />
        </div>
      )}

      {/* Revenue & funds */}
      {can('revenue') && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-6">
            <StatCard icon={DollarSign} label="Platform Revenue" value={`$${(stats.totalPlatformRevenue || 0).toFixed(2)}`} accent="#10b981" />
            <StatCard icon={DollarSign} label="Total User Funds" value={`$${(stats.totalFunds || 0).toFixed(2)}`}           accent="#3b82f6" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="card glow-border p-5">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>Total P&L (all users)</div>
              <div className={`text-3xl font-bold ${(stats.totalProfit || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {(stats.totalProfit || 0) >= 0 ? '+' : ''}${(stats.totalProfit || 0).toFixed(2)}
              </div>
            </div>
            <div className="card glow-border p-5">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>Referral Commissions Paid</div>
              <div className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>
                ${(stats.totalReferrerPaid || 0).toFixed(2)}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Recent trades */}
      {can('recentTrades') && recentTrades.length > 0 && (
        <div className="card glow-border overflow-hidden mb-6">
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Recent Trades (Platform-wide)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--surface-2)' }}>
                <tr>
                  {['User', 'Symbol', 'Side', 'P&L', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {recentTrades.map(t => (
                  <tr key={t._id} className="hover:opacity-80 transition-opacity">
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-2)' }}>
                      {t.user?.name || t.user?.email || '—'}
                    </td>
                    <td className="px-5 py-3 font-mono font-semibold" style={{ color: 'var(--text-1)' }}>{t.symbol}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        t.side === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                      }`}>{t.side}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`font-semibold flex items-center gap-1 text-xs ${(t.profit || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {(t.profit || 0) >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {(t.profit || 0) >= 0 ? '+' : ''}{(t.profit || 0).toFixed(4)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        t.status === 'closed' ? 'bg-slate-100 text-slate-500'
                          : t.status === 'open' ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-600'
                      }`}>{t.status}</span>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-3)' }}>
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
