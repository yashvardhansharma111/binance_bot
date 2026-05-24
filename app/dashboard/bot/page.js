'use client';
import { useEffect, useState, useRef } from 'react';
import {
  Activity, TrendingUp, TrendingDown, AlertTriangle, Info,
  RefreshCw, Play, Square, Wifi, WifiOff, Target, ShieldCheck,
  BarChart2, Clock, Zap, XCircle,
} from 'lucide-react';

const LEVEL_STYLE = {
  info:  { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: Info },
  warn:  { color: '#b45309', bg: '#fefce8', border: '#fde68a', icon: AlertTriangle },
  error: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: XCircle },
};

function LogLine({ log }) {
  const s = LEVEL_STYLE[log.level] || LEVEL_STYLE.info;
  const Icon = s.icon;
  const time = new Date(log.createdAt).toLocaleTimeString();
  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg text-sm"
      style={{ background: s.bg, borderLeft: `3px solid ${s.border}` }}>
      <Icon size={13} style={{ color: s.color, marginTop: 2, flexShrink: 0 }} />
      <span className="text-slate-400 shrink-0 text-xs pt-0.5 font-mono">{time}</span>
      <span className="text-slate-700 font-mono text-xs leading-relaxed">{log.message}</span>
    </div>
  );
}

function StatBox({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="card p-4 glow-border">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-slate-500 text-xs font-medium">{label}</span>
        {Icon && <Icon size={14} style={{ color }} />}
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-slate-400 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

export default function BotMonitorPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [toggling, setToggling] = useState(false);
  const logsRef = useRef(null);
  const intervalRef = useRef(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetch('/api/bot/status');
    const d   = await res.json();
    setData(d);
    setLastRefresh(new Date());
    if (!silent) setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => load(true), 8000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh]);

  async function toggleBot() {
    if (!data) return;
    setToggling(true);
    const action = data.botActive ? 'stop' : 'start';
    await fetch(`/api/bot/${action}`, { method: 'POST' });
    await load();
    setToggling(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={22} className="text-blue-500 animate-spin" />
    </div>
  );

  const { stats, openTrade, logs, settings, botActive, testnet, dryRun, todayTrades } = data;
  const modeLabel = dryRun ? 'DRY RUN' : testnet ? 'TESTNET' : 'LIVE';
  const modeStyle = dryRun
    ? { color: '#b45309', bg: '#fefce8', border: '#fde68a' }
    : testnet
    ? { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' }
    : { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Activity size={22} className="text-blue-500" />
            Bot Monitor
          </h1>
          <p className="text-slate-500 mt-0.5 text-sm">Live view of every signal, trade and decision</p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="px-3 py-1.5 rounded-full text-xs font-bold border"
            style={{ background: modeStyle.bg, color: modeStyle.color, borderColor: modeStyle.border }}>
            {modeLabel}
          </span>

          <button onClick={() => setAutoRefresh(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
            style={{
              background: autoRefresh ? '#f0fdf4' : '#f8fafc',
              color: autoRefresh ? '#16a34a' : '#64748b',
              borderColor: autoRefresh ? '#bbf7d0' : '#e2e8f0',
            }}>
            {autoRefresh ? <Wifi size={12} /> : <WifiOff size={12} />}
            {autoRefresh ? 'Live' : 'Paused'}
          </button>

          <button onClick={() => load()} className="btn-outline py-1.5 px-3 flex items-center gap-1.5 text-xs">
            <RefreshCw size={12} /> Refresh
          </button>

          <button onClick={toggleBot} disabled={toggling || !data.hasApiKey}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              background: botActive ? '#fef2f2' : '#2563eb',
              color: botActive ? '#dc2626' : 'white',
              border: botActive ? '1px solid #fecaca' : 'none',
            }}>
            {toggling ? <RefreshCw size={14} className="animate-spin" />
              : botActive ? <Square size={14} /> : <Play size={14} />}
            {botActive ? 'Stop Bot' : 'Start Bot'}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl border"
        style={{
          background:  botActive ? '#f0fdf4' : '#f8fafc',
          borderColor: botActive ? '#bbf7d0' : '#e2e8f0',
        }}>
        <span className={`w-2.5 h-2.5 rounded-full ${botActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
        <span className="text-sm font-medium" style={{ color: botActive ? '#16a34a' : '#94a3b8' }}>
          {botActive
            ? `Bot running — scanning ${settings.symbol || 'BTCUSDT'} every 5 minutes`
            : 'Bot stopped'}
        </span>
        {lastRefresh && (
          <span className="ml-auto text-slate-400 text-xs flex items-center gap-1">
            <Clock size={10} /> Updated {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <StatBox label="Today's Trades" value={stats.todayTrades}
          color="#2563eb" icon={Zap} sub={`limit: ${settings.maxDailyTrades || 10}`} />
        <StatBox label="Today's P&L"
          value={`${stats.todayProfit >= 0 ? '+' : ''}$${stats.todayProfit.toFixed(2)}`}
          color={stats.todayProfit >= 0 ? '#16a34a' : '#dc2626'}
          icon={stats.todayProfit >= 0 ? TrendingUp : TrendingDown} />
        <StatBox label="Total Trades" value={stats.totalTrades} color="#64748b" icon={BarChart2} />
        <StatBox label="Total P&L"
          value={`${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)}`}
          color={stats.totalProfit >= 0 ? '#16a34a' : '#dc2626'} />
        <StatBox label="Win Rate" value={`${stats.winRate}%`}
          color="#0891b2" icon={Target} sub={`${stats.wins}W / ${stats.losses}L`} />
        <StatBox label="Symbol" value={settings.symbol || 'BTCUSDT'}
          color="#0f172a" sub={settings.timeframe || '5m'} />
        <StatBox label="Risk / Trade" value={`${settings.tradePercent || 5}%`}
          color="#b45309" icon={ShieldCheck}
          sub={`SL ${settings.stopLossPercent || 2}% / TP ${settings.takeProfitPercent || 4}%`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">

        {/* Live log feed */}
        <div className="lg:col-span-2 card glow-border flex flex-col" style={{ height: 520 }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Activity size={15} className="text-blue-500" />
              Live AI
              {autoRefresh && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            </h2>
            <span className="text-slate-400 text-xs">{logs.length} entries</span>
          </div>
          <div ref={logsRef} className="flex-1 overflow-y-auto p-4 space-y-1.5">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Activity size={32} className="mb-3 opacity-30" />
                <p className="text-sm">No logs yet. Start the bot to see activity.</p>
              </div>
            ) : (
              logs.map(log => <LogLine key={log._id} log={log} />)
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Open position */}
          <div className="card p-5 glow-border">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm">
              <Target size={15} className="text-blue-500" /> Open Position
            </h2>
            {openTrade ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-900 font-bold text-base">{openTrade.symbol}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">OPEN</span>
                </div>
                {[
                  ['Entry Price', `$${openTrade.price?.toFixed(4)}`],
                  ['Quantity',    openTrade.qty],
                  ['Total',       `$${openTrade.total?.toFixed(2)}`],
                  ['Stop Loss',   `$${openTrade.stopLoss?.toFixed(4)}`],
                  ['Take Profit', `$${openTrade.takeProfit?.toFixed(4)}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-slate-800 font-semibold">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm py-1.5">
                  <span className="text-slate-500">Opened</span>
                  <span className="text-slate-500">{new Date(openTrade.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="mt-2 p-2.5 rounded-lg text-xs text-slate-500 bg-slate-50 border border-slate-100">
                  {openTrade.reason}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <Target size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No open position</p>
                <p className="text-xs mt-1 text-slate-300">Bot will buy when signal fires</p>
              </div>
            )}
          </div>

          {/* Today's trades */}
          <div className="card p-5 glow-border flex-1">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm">
              <BarChart2 size={15} className="text-blue-500" /> Today's Trades
            </h2>
            {todayTrades.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-sm">No trades today yet</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {todayTrades.map(t => (
                  <div key={t._id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        t.side === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                      }`}>{t.side}</span>
                      <span className="text-xs font-medium text-slate-800">{t.symbol}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-600">${t.price?.toFixed(2)}</div>
                      {t.profit !== 0 && (
                        <div className={`text-xs font-bold ${t.profit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {t.profit > 0 ? '+' : ''}${t.profit?.toFixed(4)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
