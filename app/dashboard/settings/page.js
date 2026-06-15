'use client';
import { useEffect, useState } from 'react';
import { Settings2, Save, RefreshCw, Wallet, TrendingUp, TrendingDown, Shield, Plus, X, Activity, ChevronDown, SlidersHorizontal } from 'lucide-react';
import SymbolSearch from '@/components/SymbolSearch';

const TIMEFRAMES = ['1m','5m','15m','1h','4h'];

function Row({ label, hint, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-4 border-b border-slate-100 last:border-0">
      <div className="sm:w-56 shrink-0">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step = 0.1, suffix }) {
  return (
    <div className="flex items-center gap-2">
      <input type="number" min={min} max={max} step={step}
        value={value} onChange={e => onChange(parseFloat(e.target.value))}
        className="input w-28 text-center font-mono" />
      {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
    </div>
  );
}

export default function SettingsPage() {
  const [form,       setForm]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState('');
  const [balance,    setBalance]    = useState(null);
  const [balLoading, setBalLoading] = useState(false);
  const [addSymbol,  setAddSymbol]  = useState('ETHUSDT');
  const [expandedSym, setExpandedSym] = useState(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => { setForm(d); setLoading(false); });
  }, []);

  async function fetchBalance() {
    setBalLoading(true);
    const res  = await fetch('/api/balance');
    const data = await res.json();
    setBalance(data);
    setBalLoading(false);
  }

  async function save() {
    setSaving(true); setError('');
    const res  = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    setForm(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function getSymCfg(sym) {
    return form.symbolConfigs?.find(c => c.symbol === sym) || {};
  }

  function setSymCfg(sym, key, val) {
    setForm(f => {
      const configs = f.symbolConfigs ? [...f.symbolConfigs] : [];
      const idx = configs.findIndex(c => c.symbol === sym);
      if (idx >= 0) {
        configs[idx] = { ...configs[idx], [key]: val === '' ? null : val };
      } else {
        configs.push({ symbol: sym, [key]: val === '' ? null : val });
      }
      return { ...f, symbolConfigs: configs };
    });
  }

  function clearSymCfg(sym) {
    setForm(f => ({ ...f, symbolConfigs: (f.symbolConfigs || []).filter(c => c.symbol !== sym) }));
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={22} className="text-blue-500 animate-spin" />
    </div>
  );

  const usdt = balance?.balances?.find(b => b.asset === 'USDT');

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 lg:text-2xl flex items-center gap-2">
            <Settings2 size={20} className="text-blue-500" /> Bot Settings
          </h1>
          <p className="text-slate-500 mt-0.5 text-xs lg:text-sm">Configure trading pair, risk, and bot behavior</p>
        </div>
        <button onClick={save} disabled={saving}
          className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}

      {/* Binance Balance */}
      <div className="card glow-border p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Wallet size={15} className="text-blue-500" /> Binance Balance
          </div>
          <button onClick={fetchBalance} disabled={balLoading}
            className="btn-outline py-1 px-3 text-xs flex items-center gap-1">
            <RefreshCw size={11} className={balLoading ? 'animate-spin' : ''} /> Fetch
          </button>
        </div>
        {balance ? (
          balance.error ? (
            <p className="text-sm text-red-500">{balance.error}</p>
          ) : (
            <div className="space-y-1">
              {balance.dryRun && (
                <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg mb-2 border border-amber-200">
                  DRY RUN mode — simulated balances
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {balance.balances.slice(0, 9).map(b => (
                  <div key={b.asset} className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="text-xs text-slate-400">{b.asset}</div>
                    <div className="text-sm font-bold text-slate-800 font-mono">
                      {b.free.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </div>
                    {b.locked > 0 && <div className="text-xs text-slate-400">+{b.locked} locked</div>}
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <p className="text-xs text-slate-400">Click Fetch to load your Binance balance</p>
        )}
      </div>

      {/* Settings */}
      <div className="card glow-border px-5 py-2">
        <Row label="Trading Pairs" hint={`Bot trades all listed pairs (max 10). Each pair runs independently.`}>
          <div className="space-y-2">
            {/* Active symbol chips */}
            <div className="flex flex-wrap gap-2">
              {(form.symbols?.length ? form.symbols : [form.symbol]).map(sym => (
                <span key={sym}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold"
                  style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
                  {sym}
                  <button
                    onClick={() => {
                      const current = form.symbols?.length ? form.symbols : [form.symbol];
                      const next    = current.filter(s => s !== sym);
                      if (next.length === 0) return; // must keep at least one
                      set('symbols', next);
                      set('symbol', next[0]);
                    }}
                    className="hover:text-red-500 transition-colors ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>

            {/* Add new symbol row */}
            {(form.symbols?.length || 1) < 10 && (
              <div className="flex items-center gap-2">
                <SymbolSearch value={addSymbol} onChange={setAddSymbol} size="sm" />
                <button
                  onClick={() => {
                    const sym     = addSymbol.trim().toUpperCase();
                    if (!sym) return;
                    const current = form.symbols?.length ? form.symbols : [form.symbol];
                    if (current.includes(sym)) return;
                    const next = [...current, sym];
                    set('symbols', next);
                    set('symbol', next[0]);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: '#2563eb', color: '#fff' }}>
                  <Plus size={14} /> Add
                </button>
              </div>
            )}
            <p className="text-xs text-slate-400">
              {(form.symbols?.length || 1)} pair{(form.symbols?.length || 1) !== 1 ? 's' : ''} active · remove a pair by clicking ×
            </p>

            {/* Per-symbol overrides */}
            {(() => {
              const activeSymbols = form.symbols?.length ? form.symbols : [form.symbol];
              return activeSymbols.length > 1 && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    <SlidersHorizontal size={11} /> Per-symbol overrides
                  </div>
                  {activeSymbols.map(sym => {
                    const cfg = getSymCfg(sym);
                    const isOpen = expandedSym === sym;
                    const hasCustom = form.symbolConfigs?.some(c => c.symbol === sym && (
                      c.tradeUSDT != null || c.stopLossPercent != null ||
                      c.takeProfitPercent != null || c.trailingStopPercent != null
                    ));
                    return (
                      <div key={sym} className="rounded-xl border overflow-hidden"
                        style={{ borderColor: hasCustom ? '#bfdbfe' : '#e2e8f0' }}>
                        <button
                          onClick={() => setExpandedSym(isOpen ? null : sym)}
                          className="w-full flex items-center justify-between px-3 py-2"
                          style={{ background: hasCustom ? '#eff6ff' : '#f8fafc' }}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm" style={{ color: '#1d4ed8' }}>{sym}</span>
                            {hasCustom
                              ? <span className="text-xs font-semibold text-blue-500">Custom</span>
                              : <span className="text-xs text-slate-400">Global settings</span>
                            }
                          </div>
                          <div className="flex items-center gap-2">
                            {hasCustom && (
                              <span
                                onClick={e => { e.stopPropagation(); clearSymCfg(sym); }}
                                className="text-xs text-slate-400 hover:text-red-500 px-1.5 py-0.5 rounded cursor-pointer">
                                Reset
                              </span>
                            )}
                            <ChevronDown size={13} style={{ transform: isOpen ? 'rotate(180deg)' : '', transition: 'transform 0.2s', color: '#94a3b8' }} />
                          </div>
                        </button>
                        {isOpen && (
                          <div className="px-3 py-3 border-t border-slate-100 space-y-2.5 bg-white">
                            {[
                              { key: 'tradeUSDT',           label: 'Trade Size',    suffix: 'USDT',            placeholder: `${form.tradeUSDT ?? 50}`, step: 1,   min: 1,   max: 100000 },
                              { key: 'stopLossPercent',     label: 'Stop Loss',     suffix: '% below entry',   placeholder: `${form.stopLossPercent}`,  step: 0.1, min: 0.1, max: 50 },
                              { key: 'takeProfitPercent',   label: 'Take Profit',   suffix: '% above entry',   placeholder: `${form.takeProfitPercent}`,step: 0.1, min: 0.1, max: 100 },
                              { key: 'trailingStopPercent', label: 'Trailing Stop', suffix: '% callback (0=off)', placeholder: `${form.trailingStopPercent ?? 0}`, step: 0.1, min: 0, max: 20 },
                            ].map(({ key, label, suffix, placeholder, step, min, max }) => (
                              <div key={key} className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 w-28 shrink-0">{label}</span>
                                <input
                                  type="number" min={min} max={max} step={step}
                                  placeholder={`${placeholder} (global)`}
                                  value={cfg[key] ?? ''}
                                  onChange={e => setSymCfg(sym, key, e.target.value === '' ? null : parseFloat(e.target.value))}
                                  className="input w-24 text-center font-mono text-sm py-1" />
                                <span className="text-xs text-slate-400">{suffix}</span>
                              </div>
                            ))}
                            <p className="text-xs text-slate-400 pt-1">Leave blank to use global setting</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </Row>

        <Row label="Timeframe" hint="Candle interval for signals">
          <div className="flex gap-1.5">
            {TIMEFRAMES.map(t => (
              <button key={t} onClick={() => set('timeframe', t)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                style={{
                  background:  form.timeframe === t ? '#2563eb' : '#f8fafc',
                  color:       form.timeframe === t ? '#fff' : '#64748b',
                  borderColor: form.timeframe === t ? '#2563eb' : '#e2e8f0',
                }}>
                {t}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Trade Size" hint="Fixed USDT amount per trade">
          <div className="flex items-center gap-3">
            <NumberInput value={form.tradeUSDT ?? 50} onChange={v => set('tradeUSDT', v)}
              min={1} max={100000} step={1} suffix="USDT" />
            {usdt && (
              <span className="text-xs text-slate-400">
                {(((form.tradeUSDT ?? 50) / usdt.free) * 100).toFixed(1)}% of balance
              </span>
            )}
          </div>
        </Row>

        <Row label="Stop Loss" hint={form.trailingStopPercent > 0 ? "Disabled — Trailing Stop is active" : "Auto-sell if price drops this much"}>
          <div className="flex items-center gap-2" style={{ opacity: form.trailingStopPercent > 0 ? 0.4 : 1 }}>
            <TrendingDown size={14} className="text-red-500" />
            <NumberInput value={form.stopLossPercent} onChange={v => set('stopLossPercent', v)}
              min={0.1} max={50} step={0.1} suffix="% below entry" />
          </div>
        </Row>

        <Row label="Trailing Stop" hint="Follows price up, exits when it drops back by the callback %">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => set('trailingStopPercent', form.trailingStopPercent > 0 ? 0 : 2)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
                style={{ background: form.trailingStopPercent > 0 ? '#2563eb' : '#e2e8f0' }}>
                <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                  style={{ transform: form.trailingStopPercent > 0 ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }} />
              </button>
              <span className="text-sm font-semibold" style={{ color: form.trailingStopPercent > 0 ? '#2563eb' : '#94a3b8' }}>
                {form.trailingStopPercent > 0 ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {form.trailingStopPercent > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-blue-500" />
                  <NumberInput value={form.trailingStopPercent} onChange={v => set('trailingStopPercent', v)}
                    min={0.1} max={20} step={0.1} suffix="% callback" />
                </div>
                <div className="flex gap-2">
                  {[1, 2, 5, 10].map(pct => (
                    <button key={pct} onClick={() => set('trailingStopPercent', pct)}
                      className="px-3 py-1 rounded-lg text-xs font-bold border transition-all"
                      style={{
                        background:  form.trailingStopPercent === pct ? '#2563eb' : '#f8fafc',
                        color:       form.trailingStopPercent === pct ? '#fff'    : '#64748b',
                        borderColor: form.trailingStopPercent === pct ? '#2563eb' : '#e2e8f0',
                      }}>
                      {pct}%
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  Replaces fixed Stop Loss. Exits when price falls {form.trailingStopPercent}% from peak.
                </p>
              </div>
            )}
          </div>
        </Row>

        <Row label="Take Profit" hint="Auto-sell when price rises this much">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-500" />
            <NumberInput value={form.takeProfitPercent} onChange={v => set('takeProfitPercent', v)}
              min={0.1} max={100} step={0.1} suffix="% above entry" />
          </div>
        </Row>

        <Row label="Cooldown" hint="Wait between trades">
          <NumberInput value={form.cooldownMinutes} onChange={v => set('cooldownMinutes', v)}
            min={0} max={1440} step={1} suffix="min" />
        </Row>

        <Row label="Max Daily Trades" hint="Hard limit per day">
          <NumberInput value={form.maxDailyTrades} onChange={v => set('maxDailyTrades', v)}
            min={1} max={100} step={1} suffix="trades" />
        </Row>

        <Row label="Max Concurrent Trades" hint="Open positions the bot can hold at once">
          <NumberInput value={form.maxConcurrentTrades ?? 3} onChange={v => set('maxConcurrentTrades', v)}
            min={1} max={10} step={1} suffix="positions" />
        </Row>

        <Row label="AI Sentiment Filter" hint="Use Groq AI to confirm buy signals">
          <button onClick={() => set('useGroqFilter', !form.useGroqFilter)}
            className="relative inline-flex items-center gap-3 cursor-pointer select-none">
            <div className="relative w-11 h-6 rounded-full transition-colors duration-200"
              style={{ background: form.useGroqFilter ? '#2563eb' : '#cbd5e1' }}>
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                style={{ transform: form.useGroqFilter ? 'translateX(20px)' : 'translateX(0)' }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: form.useGroqFilter ? '#2563eb' : '#94a3b8' }}>
              {form.useGroqFilter ? 'Enabled' : 'Disabled'}
            </span>
          </button>
        </Row>

        <Row label="Aggressive Mode" hint="Trade fast & ignore cooldown — RSI < 55, no filters">
          <button onClick={() => set('aggressiveMode', !form.aggressiveMode)}
            className="relative inline-flex items-center gap-3 cursor-pointer select-none">
            <div className="relative w-11 h-6 rounded-full transition-colors duration-200"
              style={{ background: form.aggressiveMode ? '#dc2626' : '#cbd5e1' }}>
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                style={{ transform: form.aggressiveMode ? 'translateX(20px)' : 'translateX(0)' }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: form.aggressiveMode ? '#dc2626' : '#94a3b8' }}>
              {form.aggressiveMode ? 'ON — Trading aggressively' : 'OFF'}
            </span>
          </button>
        </Row>
      </div>

      {/* Risk summary */}
      <div className="mt-4 px-4 py-3 rounded-xl border text-xs flex items-start gap-2"
        style={{
          background:  form.aggressiveMode ? '#fef2f2' : '#eff6ff',
          borderColor: form.aggressiveMode ? '#fecaca' : '#bfdbfe',
          color:       form.aggressiveMode ? '#dc2626' : '#1d4ed8',
        }}>
        <Shield size={14} className="shrink-0 mt-0.5" />
        <span>
          {form.aggressiveMode
            ? <>⚡ <strong>Aggressive:</strong> BUY when RSI &lt; 65 (very frequent), SELL when RSI &gt; 75 or bearish cross. No cooldown. No sentiment filter.</>
            : <>Normal: BUY when RSI &lt; 40, SELL when RSI &gt; 70 or bearish MACD cross.</>
          }{' '}
          SL <strong>{form.stopLossPercent}%</strong> · TP <strong>{form.takeProfitPercent}%</strong> · <strong>${form.tradeUSDT ?? 50}</strong> per trade · <strong>{form.symbols?.length || 1}</strong> pair{(form.symbols?.length || 1) !== 1 ? 's' : ''}.
        </span>
      </div>
    </div>
  );
}
