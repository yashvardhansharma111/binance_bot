'use client';
import { useEffect, useState } from 'react';
import { Users, Bot, ShieldCheck, TrendingUp, RefreshCw, UserX, UserCheck, Settings } from 'lucide-react';

const DEFAULT_CONFIGS = [
  { key: 'referral_commission_pct', label: 'Referral Commission %', value: 5 },
  { key: 'platform_fee_pct', label: 'Platform Fee %', value: 2 },
  { key: 'min_asset_balance', label: 'Min Asset Balance ($)', value: 100 },
  { key: 'trading_symbol', label: 'Default Trading Symbol', value: 'BTCUSDT' },
];

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [saving, setSaving] = useState('');

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
    setUsers(u);
    const cfgMap = {};
    (c || []).forEach(x => { cfgMap[x.key] = x.value; });
    DEFAULT_CONFIGS.forEach(d => { if (cfgMap[d.key] === undefined) cfgMap[d.key] = d.value; });
    setConfigs(cfgMap);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleUser(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status: newStatus }),
    });
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
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
            {[
              { label: 'Total Users', value: stats?.totalUsers, icon: Users, iconBg: '#eff6ff', iconColor: '#2563eb' },
              { label: 'Active Users', value: stats?.activeUsers, icon: UserCheck, iconBg: '#f0fdf4', iconColor: '#16a34a' },
              { label: 'Bots Running', value: stats?.activeBots, icon: Bot, iconBg: '#ecfeff', iconColor: '#0891b2' },
              { label: 'Total Trades', value: stats?.totalTrades, icon: TrendingUp, iconBg: '#fefce8', iconColor: '#b45309' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="card p-5 glow-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-500 text-sm">{s.label}</span>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.iconBg }}>
                      <Icon size={16} style={{ color: s.iconColor }} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{s.value ?? '—'}</div>
                </div>
              );
            })}
          </div>

          <div className="card p-6 glow-border">
            <h2 className="text-base font-bold text-slate-900 mb-4">Recent Trades — All Users</h2>
            {stats?.recentTrades?.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No trades yet</p>
            ) : (
              <div className="space-y-2">
                {stats?.recentTrades?.map(t => (
                  <div key={t._id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        t.side === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                      }`}>{t.side}</span>
                      <span className="text-sm font-mono font-semibold text-slate-800">{t.symbol}</span>
                      <span className="text-xs text-slate-400">{t.userId?.name || 'Unknown'}</span>
                    </div>
                    <div className="text-sm text-slate-600">${t.price?.toFixed(4)}</div>
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
                  {['Name', 'Email', 'Referral Code', 'Bot', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-600">
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800">{u.name}</span>
                        {u.role === 'admin' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-semibold">Admin</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{u.email}</td>
                    <td className="px-5 py-4 font-mono text-blue-600 font-medium">{u.referralCode}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        u.botActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {u.botActive ? 'Running' : 'Off'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        u.status === 'active' ? 'bg-emerald-100 text-emerald-700'
                          : u.status === 'blocked' ? 'bg-red-100 text-red-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}>{u.status}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4">
                      <button onClick={() => toggleUser(u._id, u.status)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          u.status === 'active'
                            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        }`}>
                        {u.status === 'active' ? <><UserX size={12} /> Block</> : <><UserCheck size={12} /> Activate</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
