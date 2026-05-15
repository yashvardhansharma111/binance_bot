'use client';
import { useEffect, useState } from 'react';
import { Key, Shield, Trash2, CheckCircle, AlertCircle, Eye, EyeOff, RefreshCw, Plus } from 'lucide-react';

export default function ApiKeysPage() {
  const [connected, setConnected] = useState(null);
  const [keyInfo, setKeyInfo] = useState(null);
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
      body: JSON.stringify(form),
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

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">API Keys</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Connect your Binance account to enable bot trading</p>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-sky-50 border border-sky-200">
        <Shield size={16} className="text-sky-600 mt-0.5 shrink-0" />
        <div className="text-sm text-sky-700">
          <strong>Security:</strong> Keys are encrypted with AES-256-GCM before storage.
          Enable only <strong>Spot &amp; Margin Trading</strong> permissions on Binance — no withdrawal access needed.
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
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle size={18} className="text-emerald-600" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">Binance Connected</div>
                <div className="text-sm text-slate-500">{keyInfo?.label || 'No label'}</div>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active
            </span>
          </div>

          <div className="space-y-0 mb-6 divide-y divide-slate-100">
            <div className="flex justify-between py-3">
              <span className="text-slate-500 text-sm">API Key</span>
              <span className="text-sm font-mono text-slate-800">{keyInfo?.maskedKey}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-slate-500 text-sm">Exchange</span>
              <span className="text-sm text-slate-800 capitalize">{keyInfo?.exchange}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-slate-500 text-sm">Connected</span>
              <span className="text-sm text-slate-800">{new Date(keyInfo?.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setConnected(false)} className="btn-outline text-sm py-2 px-4 flex items-center gap-2">
              <Plus size={14} /> Replace Key
            </button>
            <button onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-all">
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-6 glow-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Key size={18} className="text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">Connect Binance API</div>
              <div className="text-sm text-slate-500">Enter your API key and secret below</div>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Label <span className="text-slate-400 font-normal">(optional)</span></label>
              <input className="input" placeholder="e.g. My Trading Bot"
                value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">API Key</label>
              <input className="input font-mono text-sm" placeholder="Paste your Binance API Key"
                value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">API Secret</label>
              <div className="relative">
                <input className="input font-mono text-sm pr-12"
                  type={showSecret ? 'text' : 'password'} placeholder="Paste your API Secret"
                  value={form.apiSecret} onChange={e => setForm({ ...form, apiSecret: e.target.value })} required />
                <button type="button" onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-1 disabled:opacity-60">
              {loading ? 'Connecting...' : 'Connect API Key'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
