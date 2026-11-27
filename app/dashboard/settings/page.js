'use client';
import { useEffect, useState } from 'react';
import { Settings2, Save, RefreshCw, Wallet, TrendingUp, TrendingDown, Shield, Plus, X, Activity, ChevronDown, SlidersHorizontal } from 'lucide-react';
import SymbolSearch from '@/components/SymbolSearch';
import { AccountModeCard } from '@/components/DemoBanner';

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

const FUT_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'];

function Switch({ on, onClick, color = '#2563eb', label }) {
  return (
    <button onClick={onClick} className="relative inline-flex items-center gap-3 cursor-pointer select-none">
      <div className="relative w-11 h-6 rounded-full transition-colors duration-200" style={{ background: on ? color : '#cbd5e1' }}>
        <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
          style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
      </div>
      <span className="text-sm font-semibold" style={{ color: on ? color : '#94a3b8' }}>{label}</span>
    </button>
  );
}

/** Futures has its own config (Binance USDⓈ-M, isolated, one-way) — independent of the Spot tab. */
function FuturesPanel({ f, setF, addFut, setAddFut }) {
  if (!f) return null;
  const lev   = f.leverage || 3;
  const maxSl = parseFloat(((100 / lev - 0.5) * 0.8).toFixed(2));
  const slBad = !(f.stopLossPercent > 0 && f.stopLossPercent <= maxSl);
  const AMBER = '#d97706';
  return (
    <>
      <div className="card glow-border px-5 py-2">
        <Row label="Futures trading" hint="Binance USDⓈ-M · isolated margin · one-way mode">
          <Switch on={f.enabled} onClick={() => setF('enabled', !f.enabled)} color={AMBER}
            label={f.enabled ? 'ON — bot opens futures trades' : 'OFF'} />
        </Row>

        <Row label="Futures pairs" hint="Max 10. Separate from your spot pairs.">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {f.symbols.length === 0 && <span className="text-xs text-slate-400">No futures pairs yet</span>}
              {f.symbols.map(sym => (
                <span key={sym} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold"
                  style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309' }}>
                  {sym}
                  <button onClick={() => setF('symbols', f.symbols.filter(s => s !== sym))} className="hover:text-red-500 transition-colors ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            {f.symbols.length < 10 && (
              <div className="flex items-center gap-2">
                <SymbolSearch value={addFut} onChange={setAddFut} size="sm" />
                <button onClick={() => {
                    const sym = (addFut || '').trim().toUpperCase();
                    if (sym && !f.symbols.includes(sym)) setF('symbols', [...f.symbols, sym]);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: AMBER, color: '#fff' }}>
                  <Plus size={14} /> Add
                </button>
              </div>
            )}
          </div>
        </Row>

        <Row label="Timeframe" hint="Candles the futures bot reads">
          <div className="flex flex-wrap gap-1">
            {FUT_TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setF('timeframe', tf)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: f.timeframe === tf ? '#fffbeb' : '#f8fafc', color: f.timeframe === tf ? AMBER : '#64748b',
                  border: `1px solid ${f.timeframe === tf ? '#fde68a' : '#e2e8f0'}` }}>
                {tf}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Margin per trade" hint={`Position size = margin × leverage (now $${(f.tradeUSDT * lev).toLocaleString()})`}>
          <NumberInput value={f.tradeUSDT} onChange={v => setF('tradeUSDT', v)} min={5} max={100000} step={5} suffix="USDT" />
        </Row>

        <Row label="Leverage" hint="Isolated margin · max 20x. Higher leverage = closer liquidation.">
          <div className="flex items-center gap-3">
            <input type="range" min={1} max={20} step={1} value={lev}
              onChange={e => setF('leverage', parseInt(e.target.value, 10))} className="w-40 accent-amber-500" />
            <span className="w-12 text-center font-mono text-sm font-bold text-amber-600">{lev}x</span>
          </div>
        </Row>

        <Row label="Allow shorts" hint="Open a SHORT on a SELL signal (only in a downtrend)">
          <Switch on={f.allowShort} onClick={() => setF('allowShort', !f.allowShort)} color={AMBER} label={f.allowShort ? 'Long + Short' : 'Long only'} />
        </Row>

        <Row label="Stop loss" hint={`Always on in futures · max ${maxSl}% at ${lev}x`}>
          <NumberInput value={f.stopLossPercent} onChange={v => setF('stopLossPercent', v)} min={0.1} max={maxSl} step={0.1} suffix="%" />
        </Row>
        <Row label="Take profit">
          <NumberInput value={f.takeProfitPercent} onChange={v => setF('takeProfitPercent', v)} min={0.1} max={100} step={0.1} suffix="%" />
        </Row>
        <Row label="Trailing stop" hint="0 = off · only exits a trade that is in profit">
          <NumberInput value={f.trailingStopPercent} onChange={v => setF('trailingStopPercent', v || 0)} min={0} max={20} step={0.1} suffix="%" />
        </Row>
        <Row label="Max loss" hint="0 = off · closes a position this far against you (price move)">
          <NumberInput value={f.maxLossPercent} onChange={v => setF('maxLossPercent', v || 0)} min={0} max={100} step={0.5} suffix="%" />
        </Row>

        <Row label="Aggressive mode" hint="More entries, fewer filters — higher risk">
          <Switch on={f.aggressiveMode} onClick={() => setF('aggressiveMode', !f.aggressiveMode)} color="#dc2626" label={f.aggressiveMode ? 'ON' : 'OFF'} />
        </Row>
        <Row label="AI sentiment filter" hint="Skip trades the AI reads as going the other way">
          <Switch on={f.useGroqFilter} onClick={() => setF('useGroqFilter', !f.useGroqFilter)} label={f.useGroqFilter ? 'Enabled' : 'Disabled'} />
        </Row>
        <Row label="Pre-trade checklist" hint="10 cross-checks before every futures entry">
          <div className="flex flex-wrap items-center gap-3">
            <Switch on={f.entryChecklist} onClick={() => setF('entryChecklist', !f.entryChecklist)} color="#16a34a" label={f.entryChecklist ? 'On' : 'Off'} />
            {f.entryChecklist && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Must pass
                <select value={f.checklistMinPass} onChange={e => setF('checklistMinPass', parseInt(e.target.value, 10))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-sm">
                  {[10, 9, 8, 7, 6].map(n => <option key={n} value={n}>{n}/10</option>)}
                </select>
              </label>
            )}
          </div>
        </Row>
      </div>

      <div className={`mt-4 rounded-xl border px-4 py-3 text-xs leading-relaxed ${slBad ? 'border-red-200 bg-red-50 text-red-600' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
        <strong>⚠ Futures risk:</strong> at {lev}x a {(100 / lev).toFixed(1)}% move against you liquidates the position.
        Stop loss must be <strong>≤ {maxSl}%</strong> (now {f.stopLossPercent}%{slBad ? ' — too wide, lower it before saving' : ''}).
        Needs a Binance key with <strong>Futures</strong> enabled, One-way mode, and USDT in the USDⓈ-M Futures wallet.
      </div>
    </>
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
  const [tab,        setTab]        = useState('spot');
  const [addFut,     setAddFut]     = useState('BTCUSDT');

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
  function setF(key, val) { setForm(f => ({ ...f, futures: { ...f.futures, [key]: val } })); }

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
            <Wallet size={15} className="text-blue-500" /> Exchange Balance
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

      <AccountModeCard />

      {/* Market tabs — Spot and Futures have separate configs and can run together */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          {[['spot', 'Spot'], ['futures', 'Futures']].map(([val, label]) => {
            const on = val === 'spot' ? form.spotEnabled !== false : !!form.futures?.enabled;
            return (
              <button key={val} onClick={() => setTab(val)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-all"
                style={{
                  background: tab === val ? 'white' : 'transparent',
                  color: tab === val ? (val === 'futures' ? '#d97706' : '#2563eb') : '#64748b',
                  boxShadow: tab === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                  {on ? 'ON' : 'OFF'}
                </span>
              </button>
            );
          })}
        </div>
        <span className="text-xs text-slate-500">
          {form.spotEnabled === false && !form.futures?.enabled
            ? '⚠ Both are OFF — the bot will not open new trades.'
            : 'Each market has its own settings. When both are ON the bot trades both.'}
        </span>
      </div>

      {tab === 'futures' && <FuturesPanel f={form.futures} setF={setF} addFut={addFut} setAddFut={setAddFut} />}

      {tab === 'spot' && (<>
      {/* Settings */}
      <div className="card glow-border px-5 py-2">
        <Row label="Spot trading" hint="Buy and sell coins on spot with the settings below">
          <Switch on={form.spotEnabled !== false} onClick={() => set('spotEnabled', form.spotEnabled === false)}
            label={form.spotEnabled !== false ? 'ON — bot opens spot trades' : 'OFF'} />
        </Row>

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

        <Row label="Stop Loss" hint={form.trailingStopPercent > 0 ? "Disabled — Trailing Stop is active" : form.useStopLoss === false ? "OFF — bot only exits on Take Profit or signal" : "Auto-sell if price drops this much"}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => set('useStopLoss', form.useStopLoss === false ? true : false)}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
                style={{ background: form.useStopLoss !== false ? '#2563eb' : '#e2e8f0' }}>
                <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                  style={{ transform: form.useStopLoss !== false ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }} />
              </button>
              <span className="text-sm font-semibold" style={{ color: form.useStopLoss !== false ? '#2563eb' : '#94a3b8' }}>
                {form.useStopLoss !== false ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {form.useStopLoss !== false && (
              <div className="flex items-center gap-2" style={{ opacity: form.trailingStopPercent > 0 ? 0.4 : 1 }}>
                <TrendingDown size={14} className="text-red-500" />
                <NumberInput value={form.stopLossPercent} onChange={v => set('stopLossPercent', v)}
                  min={0.1} max={50} step={0.1} suffix="% below entry" />
              </div>
            )}
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

        <Row label="Pre-trade Checklist" hint="10 cross-checks before every new entry: signal, 1h trend, local trend, RSI turn, momentum, volume, volatility & fees, not chasing, BTC health, AI sentiment">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => set('entryChecklist', form.entryChecklist !== true)}
              className="relative inline-flex items-center gap-3 cursor-pointer select-none">
              <div className="relative w-11 h-6 rounded-full transition-colors duration-200"
                style={{ background: form.entryChecklist === true ? '#16a34a' : '#cbd5e1' }}>
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                  style={{ transform: form.entryChecklist === true ? 'translateX(20px)' : 'translateX(0)' }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: form.entryChecklist === true ? '#16a34a' : '#94a3b8' }}>
                {form.entryChecklist === true ? 'On' : 'Off'}
              </span>
            </button>
            {form.entryChecklist === true && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Must pass
                <select value={form.checklistMinPass ?? 10}
                  onChange={e => set('checklistMinPass', parseInt(e.target.value, 10))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-sm">
                  {[10, 9, 8, 7, 6].map(n => <option key={n} value={n}>{n}/10</option>)}
                </select>
                <span className="text-xs text-slate-400">more = fewer, safer trades</span>
              </label>
            )}
          </div>
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
      </>)}
    </div>
  );
}
