'use client';
import { useEffect, useState } from 'react';
import {
  Users, Bot, ShieldCheck, TrendingUp, RefreshCw, UserX, UserCheck,
  Settings, DollarSign, Percent, Star, CreditCard, Activity, Ticket,
  Send,
} from 'lucide-react';

const DEFAULT_CONFIGS = [
  { key: 'referral_commission_pct', label: 'Referral Commission %', value: 5 },
  { key: 'platform_fee_pct', label: 'Platform Fee %', value: 2 },
  { key: 'min_asset_balance', label: 'Min Asset Balance ($)', value: 100 },
  { key: 'trading_symbol', label: 'Default Trading Symbol', value: 'BTCUSDT' },
];

function StatCard({ label, value, icon: Icon, iconBg, iconColor, prefix = '', suffix = '' }) {
  return (
    <div className="card p-5 glow-border">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-500 text-sm">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
          <Icon size={16} style={{ color: iconColor }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{prefix}{value ?? '—'}{suffix}</div>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [saving, setSaving] = useState('');
  const [grantingId, setGrantingId] = useState(null);
  const [grantDays, setGrantDays] = useState('30');
  const [grantLoading, setGrantLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  async function load() {
    setLoading(true);
    const [sRes, uRes, cRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/users'),
      fetch('/api/admin/config'),
    ]);
    const s = await sRes.json();
    const u = await uRes.json();
    const c = await cRes.json();
    setStats(s);
    setUsers(Array.isArray(u) ? u : []);
    const cfgMap = {};
    (c || []).forEach(x => { cfgMap[x.key] = x.value; });
    DEFAULT_CONFIGS.forEach(d => { if (cfgMap[d.key] === undefined) cfgMap[d.key] = d.value; });
    setConfigs(cfgMap);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function loadTickets() {
    setTicketsLoading(true);
    const res = await fetch('/api/admin/tickets');
    const d = await res.json();
    setTickets(d.tickets || []);
    setTicketsLoading(false);
  }

  useEffect(() => { if (tab === 'tickets') loadTickets(); }, [tab]);

  async function updateTicket(ticketId, update) {
    await fetch('/api/admin/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, ...update }),
    });
    loadTickets();
  }

  async function deleteUser(userId) {
    setDeleteLoading(true);
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setDeleteLoading(false);
    setDeleteConfirm(null);
    load();
  }

  async function sendReply(ticketId) {
    if (!replyText.trim()) return;
    setReplyLoading(true);
    await updateTicket(ticketId, { adminReply: replyText.trim(), status: 'in_progress' });
    setReplyingId(null);
    setReplyText('');
    setReplyLoading(false);
  }

  async function toggleUser(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status: newStatus }),
    });
    load();
  }

  async function grantSub(userId) {
    setGrantLoading(true);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, grantDays: Number(grantDays) }),
    });
    setGrantLoading(false);
    setGrantingId(null);
    setGrantDays('30');
    load();
  }

  async function saveConfig(key, label) {
    setSaving(key);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: configs[key], label }),
    });
    setSaving('');
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={22} className="text-blue-500 animate-spin" />
    </div>
  );

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'commissions', label: 'Commissions' },
    { id: 'tickets', label: 'Tickets' },
    { id: 'config', label: 'Config' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <ShieldCheck size={22} className="text-amber-500" /> Admin Panel
          </h1>
          <p className="text-slate-500 mt-0.5 text-sm">Platform management and monitoring</p>
        </div>
        <button onClick={load} className="btn-outline py-2 px-4 flex items-center gap-2 text-sm">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-5 py-2 rounded-md text-sm font-medium transition-all"
            style={{
              background: tab === t.id ? 'white' : 'transparent',
              color: tab === t.id ? '#0f172a' : '#64748b',
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div>
          {/* User stats */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Users & Bots</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Users"    value={stats?.totalUsers}  icon={Users}     iconBg="#eff6ff" iconColor="#2563eb" />
            <StatCard label="Active Users"   value={stats?.activeUsers} icon={UserCheck} iconBg="#f0fdf4" iconColor="#16a34a" />
            <StatCard label="Bots Running"   value={stats?.activeBots}  icon={Bot}       iconBg="#ecfeff" iconColor="#0891b2" />
            <StatCard label="Blocked Users"  value={stats?.blockedUsers} icon={UserX}    iconBg="#fef2f2" iconColor="#dc2626" />
          </div>

          {/* Trade stats */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Trading</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Trades"  value={stats?.totalTrades}  icon={TrendingUp} iconBg="#fefce8" iconColor="#b45309" />
            <StatCard label="Closed Trades" value={stats?.closedTrades} icon={Activity}   iconBg="#f0fdf4" iconColor="#16a34a" />
            <StatCard label="Total Profit"  value={stats?.totalProfit?.toFixed(2)}  icon={DollarSign} iconBg="#f0fdf4" iconColor="#16a34a" prefix="$" />
            <StatCard label="Commissions"   value={stats?.commissionCount} icon={Percent} iconBg="#faf5ff" iconColor="#7c3aed" />
          </div>

          {/* Revenue stats */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Revenue & Funds</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total User Funds"  value={stats?.totalFunds?.toFixed(2)}           icon={DollarSign}  iconBg="#f0fdf4" iconColor="#16a34a" prefix="$" />
            <StatCard label="Platform Revenue"  value={stats?.totalPlatformRevenue?.toFixed(2)} icon={TrendingUp}  iconBg="#ecfdf5" iconColor="#059669" prefix="$" />
            <StatCard label="Referrer Paid Out" value={stats?.totalReferrerPaid?.toFixed(2)}    icon={Star}        iconBg="#fffbeb" iconColor="#d97706" prefix="$" />
            <StatCard label="Active Subs"       value={stats?.activeSubs}                       icon={CreditCard}  iconBg="#eff6ff" iconColor="#2563eb" />
          </div>

          {/* Recent trades */}
          <div className="card p-6 glow-border">
            <h2 className="text-base font-bold text-slate-900 mb-4">Recent Trades — All Users</h2>
            {!stats?.recentTrades?.length ? (
              <p className="text-slate-400 text-sm text-center py-8">No trades yet</p>
            ) : (
              <div className="space-y-2">
                {stats.recentTrades.map(t => (
                  <div key={t._id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        t.side === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                      }`}>{t.side}</span>
                      <span className="text-sm font-mono font-semibold text-slate-800">{t.symbol}</span>
                      <span className="text-xs text-slate-400">{t.userId?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-600">${t.price?.toFixed(4)}</span>
                      {t.profit != null && (
                        <span className={`text-xs font-semibold ${t.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="card glow-border overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">All Users</h2>
            <span className="text-sm text-slate-500">{users.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Name', 'Email', 'Referral', 'Balance', 'Bot', 'Subscription', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-600 shrink-0">
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800 whitespace-nowrap">{u.name}</span>
                        {u.role === 'admin' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-semibold">Admin</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                    <td className="px-4 py-3 font-mono text-blue-600 font-medium text-xs">{u.referralCode}</td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs font-semibold">${(u.assetBalance || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        u.botActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {u.botActive ? 'Running' : 'Off'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.subscriptionActive ? (
                        <span className="text-xs font-semibold text-emerald-600">
                          Active · {u.subscriptionDaysLeft}d left
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        u.status === 'active' ? 'bg-emerald-100 text-emerald-700'
                          : u.status === 'blocked' ? 'bg-red-100 text-red-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}>{u.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button onClick={() => toggleUser(u._id, u.status)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                            u.status === 'active'
                              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          }`}>
                          {u.status === 'active' ? <><UserX size={12} /> Block</> : <><UserCheck size={12} /> Activate</>}
                        </button>
                        {grantingId === u._id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number" min="1" max="365"
                              value={grantDays}
                              onChange={e => setGrantDays(e.target.value)}
                              className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded-lg text-center"
                            />
                            <span className="text-xs text-slate-400">d</span>
                            <button
                              onClick={() => grantSub(u._id)}
                              disabled={grantLoading}
                              className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                              {grantLoading ? '…' : 'OK'}
                            </button>
                            <button
                              onClick={() => setGrantingId(null)}
                              className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setGrantingId(u._id); setGrantDays('30'); }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 whitespace-nowrap">
                            <Star size={11} /> Grant Sub
                          </button>
                        )}
                        {deleteConfirm === u._id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-600 font-semibold whitespace-nowrap">Delete?</span>
                            <button
                              onClick={() => deleteUser(u._id)}
                              disabled={deleteLoading}
                              className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                              {deleteLoading ? '…' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200">
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(u._id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 whitespace-nowrap">
                            🗑 Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commissions */}
      {tab === 'commissions' && (
        <div>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Commission Collected" value={stats?.totalCommission?.toFixed(4)}     icon={Percent}    iconBg="#faf5ff" iconColor="#7c3aed" prefix="$" />
            <StatCard label="Platform Revenue"           value={stats?.totalPlatformRevenue?.toFixed(4)} icon={DollarSign} iconBg="#ecfdf5" iconColor="#059669" prefix="$" />
            <StatCard label="Referrer Earnings"          value={stats?.totalReferrerPaid?.toFixed(4)}   icon={Star}       iconBg="#fffbeb" iconColor="#d97706" prefix="$" />
          </div>

          <div className="card p-6 glow-border">
            <h2 className="text-base font-bold text-slate-900 mb-2">Commission Breakdown</h2>
            <p className="text-xs text-slate-400 mb-5">15% of each profitable trade: 10% referrer + 5% platform (or 15% platform if no referrer)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 p-5 text-center">
                <div className="text-3xl font-bold text-violet-600 mb-1">${stats?.totalCommission?.toFixed(2) ?? '0.00'}</div>
                <div className="text-sm text-slate-500">Total Commission</div>
                <div className="text-xs text-slate-400 mt-1">from {stats?.commissionCount ?? 0} trades</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-5 text-center">
                <div className="text-3xl font-bold text-emerald-600 mb-1">${stats?.totalPlatformRevenue?.toFixed(2) ?? '0.00'}</div>
                <div className="text-sm text-slate-500">Platform Revenue</div>
                <div className="text-xs text-slate-400 mt-1">5% or 15% per trade</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-5 text-center">
                <div className="text-3xl font-bold text-amber-500 mb-1">${stats?.totalReferrerPaid?.toFixed(2) ?? '0.00'}</div>
                <div className="text-sm text-slate-500">Referrer Paid Out</div>
                <div className="text-xs text-slate-400 mt-1">10% per referred trade</div>
              </div>
            </div>
          </div>

          <div className="card p-6 glow-border mt-5">
            <h2 className="text-base font-bold text-slate-900 mb-4">Subscriptions</h2>
            <div className="flex gap-8">
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats?.activeSubs ?? 0}</div>
                <div className="text-sm text-slate-500 mt-0.5">Active Subscribers</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-600">{stats?.totalSubs ?? 0}</div>
                <div className="text-sm text-slate-500 mt-0.5">Total Subscriptions</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tickets */}
      {tab === 'tickets' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Support Tickets</h2>
            <button onClick={loadTickets} className="btn-outline py-1.5 px-3 flex items-center gap-1.5 text-xs">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {ticketsLoading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw size={22} className="text-blue-500 animate-spin" />
            </div>
          ) : !tickets.length ? (
            <div className="card p-10 glow-border text-center text-slate-400">
              <Ticket size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No tickets yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map(t => {
                const PRIORITY_COLOR = { low: '#16a34a', medium: '#b45309', high: '#dc2626' };
                const STATUS_BG = { open: '#eff6ff', in_progress: '#fefce8', closed: '#f1f5f9' };
                const STATUS_COLOR = { open: '#2563eb', in_progress: '#b45309', closed: '#64748b' };
                return (
                  <div key={t._id} className="card glow-border p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-slate-900 text-sm">{t.subject}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                            style={{ background: STATUS_BG[t.status] || '#f1f5f9', color: STATUS_COLOR[t.status] || '#64748b' }}>
                            {t.status?.replace('_', ' ')}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ background: '#fef9c3', color: PRIORITY_COLOR[t.priority] || '#b45309' }}>
                            {t.priority}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mb-2">
                          {t.userId?.name} · {t.userId?.email} · {new Date(t.createdAt).toLocaleString()}
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{t.message}</p>
                        {t.adminReply && (
                          <div className="mt-3 px-3 py-2.5 rounded-xl text-sm"
                            style={{ background: '#eff6ff', borderLeft: '3px solid #2563eb' }}>
                            <span className="text-xs font-bold text-blue-600 block mb-1">Admin Reply · {new Date(t.repliedAt).toLocaleString()}</span>
                            <p className="text-slate-700 whitespace-pre-wrap">{t.adminReply}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        <select
                          value={t.status}
                          onChange={e => updateTicket(t._id, { status: e.target.value })}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="closed">Closed</option>
                        </select>
                        <button
                          onClick={() => { setReplyingId(replyingId === t._id ? null : t._id); setReplyText(t.adminReply || ''); }}
                          className="btn-outline py-1.5 px-3 text-xs flex items-center gap-1.5">
                          <Send size={11} /> {t.adminReply ? 'Edit Reply' : 'Reply'}
                        </button>
                      </div>
                    </div>

                    {replyingId === t._id && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                        <textarea
                          rows={3}
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="Type your reply to the user…"
                          className="input w-full text-sm resize-none mb-2" />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { setReplyingId(null); setReplyText(''); }}
                            className="btn-outline py-1.5 px-3 text-xs">Cancel</button>
                          <button onClick={() => sendReply(t._id)}
                            disabled={replyLoading || !replyText.trim()}
                            className="btn-primary py-1.5 px-4 text-xs flex items-center gap-1.5 disabled:opacity-50">
                            {replyLoading ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                            Send Reply
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
      )}

      {/* Config */}
      {tab === 'config' && (
        <div className="max-w-xl">
          <div className="card p-6 glow-border">
            <div className="flex items-center gap-3 mb-6">
              <Settings size={18} className="text-slate-500" />
              <h2 className="text-base font-bold text-slate-900">System Configuration</h2>
            </div>
            <div className="space-y-5">
              {DEFAULT_CONFIGS.map(cfg => (
                <div key={cfg.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{cfg.label}</label>
                  <div className="flex gap-3">
                    <input className="input flex-1" type="text"
                      value={configs[cfg.key] ?? cfg.value}
                      onChange={e => setConfigs({ ...configs, [cfg.key]: e.target.value })} />
                    <button onClick={() => saveConfig(cfg.key, cfg.label)}
                      disabled={saving === cfg.key}
                      className="btn-primary py-2 px-4 text-sm shrink-0 disabled:opacity-60">
                      {saving === cfg.key ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
