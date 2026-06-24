'use client';
import { useEffect, useState } from 'react';
import {
  Key, Shield, Trash2, CheckCircle, AlertCircle, Eye, EyeOff,
  RefreshCw, Plus, FlaskConical, BadgeCheck, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';

function GuideSection({ accountType }) {
  const [open, setOpen] = useState(false);

  if (accountType === 'testnet') return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 overflow-hidden mb-6">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-2.5">
          <FlaskConical size={16} className="text-violet-600" />
          <span className="font-semibold text-violet-800 text-sm">How to get Binance Testnet API keys</span>
        </div>
        {open ? <ChevronUp size={15} className="text-violet-500" /> : <ChevronDown size={15} className="text-violet-500" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 text-sm text-violet-800 border-t border-violet-200 pt-4">
          <p className="font-medium">Testnet = paper trading. No real money at risk.</p>
          <ol className="space-y-2.5 list-decimal list-inside">
            <li>
              Go to{' '}
              <a href="https://testnet.binance.vision" target="_blank" rel="noreferrer"
                className="underline font-semibold inline-flex items-center gap-1">
                testnet.binance.vision <ExternalLink size={11} />
              </a>
            </li>
            <li>Click <strong>Log In with GitHub</strong> and authorize</li>
            <li>Under <strong>API Management</strong>, click <strong>Generate HMAC_SHA256 Key</strong></li>
            <li>Copy the <strong>API Key</strong> and <strong>Secret Key</strong> — secret is shown only once</li>
            <li>Your testnet wallet starts with <strong>1 BTC + 10,000 USDT</strong> automatically</li>
          </ol>
          <div className="mt-3 p-3 bg-violet-100 rounded-lg text-xs text-violet-700">
            Testnet uses a completely separate environment — trades never touch real funds.
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden mb-6">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-2.5">
          <BadgeCheck size={16} className="text-blue-600" />
          <span className="font-semibold text-blue-800 text-sm">How to get a real Binance API key</span>
        </div>
        {open ? <ChevronUp size={15} className="text-blue-500" /> : <ChevronDown size={15} className="text-blue-500" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 text-sm text-blue-800 border-t border-blue-200 pt-4">
          <p className="font-medium text-red-600">⚠️ Real mode uses actual funds. Only enable Spot trading — never Withdrawals.</p>
          <ol className="space-y-2.5 list-decimal list-inside">
            <li>
              Log in at{' '}
              <a href="https://www.binance.com" target="_blank" rel="noreferrer"
                className="underline font-semibold inline-flex items-center gap-1">
                binance.com <ExternalLink size={11} />
              </a>
            </li>
            <li>Click your avatar → <strong>API Management</strong></li>
            <li>Click <strong>Create API</strong> → choose <strong>System generated</strong></li>
            <li>Give it a label (e.g. &quot;TrickyX Bot&quot;) and complete 2FA</li>
            <li>
              Under <strong>API Restrictions</strong>, enable only:
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li><strong>Enable Reading</strong></li>
                <li><strong>Enable Spot &amp; Margin Trading</strong></li>
              </ul>
            </li>
            <li>Optionally restrict to your server&apos;s IP for extra security</li>
            <li>Copy the <strong>API Key</strong> and <strong>Secret Key</strong> — secret shown once only</li>
          </ol>
          <div className="mt-3 p-3 bg-blue-100 rounded-lg text-xs text-blue-700">
            Never enable <strong>Withdrawals</strong> or <strong>Transfer</strong> permissions. TrickyX only needs trading access.
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiKeysPage() {
  const [connected, setConnected] = useState(null);
  const [keyInfo, setKeyInfo] = useState(null);
  const [accountType, setAccountType] = useState('real');
  const [exchange,    setExchange]    = useState('binance');
  const [form, setForm] = useState({ apiKey: '', apiSecret: '', label: '' });
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  async function load() {
    const res = await fetch('/api/apikeys');
    const data = await res.json();
    setConnected(data.connected);
    setKeyInfo(data);
  }

  useEffect(() => { load(); }, []);

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });
    const res = await fetch('/api/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, accountType, exchange }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setMsg({ type: 'error', text: data.error });
    setMsg({ type: 'success', text: 'API key connected successfully!' });
    setForm({ apiKey: '', apiSecret: '', label: '' });
    load();
  }

  async function handleDelete() {
    if (!confirm('Remove this API key? The bot will be stopped.')) return;
    await fetch('/api/apikeys', { method: 'DELETE' });
    setMsg({ type: 'success', text: 'API key removed' });
    load();
  }

  const isTestnet = keyInfo?.accountType === 'testnet';

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Connect your Binance account — real or testnet</p>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-sky-50 border border-sky-200">
        <Shield size={16} className="text-sky-600 mt-0.5 shrink-0" />
        <div className="text-sm text-sky-700">
          <strong>Security:</strong> Keys are encrypted with AES-256-GCM before storage and never transmitted in plaintext.
        </div>
      </div>

      {msg.text && (
        <div className={`flex items-center gap-2 p-3 rounded-lg mb-5 text-sm border ${
          msg.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {msg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {msg.text}
        </div>
      )}

      {connected === null ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw size={22} className="text-blue-500 animate-spin" />
        </div>
      ) : connected ? (
        <div className="card p-6 glow-border">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: isTestnet ? '#f5f3ff' : '#f0fdf4', border: `1px solid ${isTestnet ? '#ddd6fe' : '#bbf7d0'}` }}>
                {isTestnet
                  ? <FlaskConical size={18} className="text-violet-600" />
                  : <CheckCircle size={18} className="text-emerald-600" />}
              </div>
              <div>
                <div className="font-semibold text-slate-900">
                  {keyInfo?.exchange === 'bingx' ? 'BingX' : isTestnet ? 'Binance Testnet' : 'Binance Live'} Connected
                </div>
                <div className="text-sm text-slate-500">{keyInfo?.label || 'No label'}</div>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              isTestnet
                ? 'bg-violet-50 text-violet-700 border-violet-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {isTestnet ? 'Testnet' : 'Live'}
            </span>
          </div>

          <div className="space-y-0 mb-6 divide-y divide-slate-100">
            <div className="flex justify-between py-3">
              <span className="text-slate-500 text-sm">API Key</span>
              <span className="text-sm font-mono text-slate-800">{keyInfo?.maskedKey}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-slate-500 text-sm">Account Type</span>
              <span className={`text-sm font-semibold ${isTestnet ? 'text-violet-600' : 'text-emerald-600'}`}>
                {isTestnet ? '🧪 Testnet (Paper)' : '✅ Real Account'}
              </span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-slate-500 text-sm">Connected</span>
              <span className="text-sm text-slate-800">{new Date(keyInfo?.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setConnected(false); setAccountType(keyInfo?.accountType || 'real'); }}
              className="btn-outline text-sm py-2 px-4 flex items-center gap-2">
              <Plus size={14} /> Replace Key
            </button>
            <button onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-all">
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Exchange selector */}
          <div className="flex gap-3 mb-4">
            <button onClick={() => { setExchange('binance'); setAccountType('real'); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                exchange === 'binance'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}>
              <Key size={16} /> Binance
            </button>
            <button onClick={() => { setExchange('bingx'); setAccountType('real'); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                exchange === 'bingx'
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}>
              <Key size={16} /> BingX
            </button>
          </div>

          {/* Account type toggle — Binance only (BingX has no testnet) */}
          {exchange === 'binance' && (
          <div className="flex gap-3 mb-6">
            <button onClick={() => setAccountType('real')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                accountType === 'real'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}>
              <BadgeCheck size={16} /> Real Account
            </button>
            <button onClick={() => setAccountType('testnet')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                accountType === 'testnet'
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}>
              <FlaskConical size={16} /> Testnet (Paper)
            </button>
          </div>
          )}

          {/* Inline guide */}
          {exchange === 'bingx' ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50 overflow-hidden mb-6">
              <button onClick={() => {}} className="w-full flex items-center gap-2.5 px-5 py-4 text-left">
                <BadgeCheck size={16} className="text-orange-600" />
                <span className="font-semibold text-orange-800 text-sm">How to get a BingX API key</span>
              </button>
              <div className="px-5 pb-5 space-y-3 text-sm text-orange-800 border-t border-orange-200 pt-4">
                <p className="font-medium text-red-600">⚠️ Enable Spot trading only — never Withdrawals.</p>
                <ol className="space-y-2.5 list-decimal list-inside">
                  <li>Log in at <strong>bingx.com</strong></li>
                  <li>Go to <strong>Account → API Management</strong></li>
                  <li>Click <strong>Create API</strong>, give it a name</li>
                  <li>Enable <strong>Spot Trading</strong> permission only</li>
                  <li>Optionally whitelist your server IP</li>
                  <li>Copy the <strong>API Key</strong> and <strong>Secret Key</strong></li>
                </ol>
              </div>
            </div>
          ) : (
            <GuideSection accountType={accountType} />
          )}

          <div className="card p-6 glow-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                <Key size={18} className="text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">
                  {exchange === 'bingx' ? 'Connect BingX API' : accountType === 'testnet' ? 'Connect Testnet API' : 'Connect Binance API'}
                </div>
                <div className="text-sm text-slate-500">
                  {exchange === 'bingx' ? 'BingX Spot trading' : accountType === 'testnet' ? 'Paper trading — no real funds' : 'Live trading with real funds'}
                </div>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Label <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input className="input" placeholder={accountType === 'testnet' ? 'e.g. Test Account' : 'e.g. My Trading Bot'}
                  value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">API Key</label>
                <input className="input font-mono text-sm"
                  placeholder={accountType === 'testnet' ? 'Testnet API Key' : 'Binance API Key'}
                  value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value.trim() })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">API Secret</label>
                <div className="relative">
                  <input className="input font-mono text-sm" style={{ paddingRight: '3rem' }}
                    type={showSecret ? 'text' : 'password'}
                    placeholder={accountType === 'testnet' ? 'Testnet Secret Key' : 'Binance Secret Key'}
                    value={form.apiSecret} onChange={e => setForm({ ...form, apiSecret: e.target.value.trim() })} required />
                  <button type="button" onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className={`w-full py-3 mt-1 text-sm font-semibold rounded-lg disabled:opacity-60 transition-all text-white ${
                  accountType === 'testnet'
                    ? 'bg-violet-600 hover:bg-violet-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}>
                {loading ? 'Connecting...' : exchange === 'bingx' ? '🟠 Connect BingX' : accountType === 'testnet' ? '🧪 Connect Testnet' : '✅ Connect Binance'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
