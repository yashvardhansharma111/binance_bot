'use client';
import { useEffect, useState } from 'react';
import { User, Mail, Phone, Save, RefreshCw, CheckCircle } from 'lucide-react';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form,    setForm]    = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(d => {
        setProfile(d);
        setForm({ name: d.name || '', phone: d.phone || '' });
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true); setError('');
    const res  = await fetch('/api/user/profile', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    setProfile(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={22} className="text-blue-500 animate-spin" />
    </div>
  );

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 lg:text-2xl flex items-center gap-2">
            <User size={20} className="text-blue-500" /> My Profile
          </h1>
          <p className="text-slate-500 mt-0.5 text-xs lg:text-sm">Manage your account details</p>
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

      {!profile?.phone && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
          <Phone size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Add your phone number</p>
            <p className="text-xs text-amber-600 mt-0.5">Keep your account secure and reachable</p>
          </div>
        </div>
      )}

      <div className="card glow-border px-5 py-2">
        {/* Name */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-4 border-b border-slate-100">
          <div className="sm:w-40 shrink-0">
            <div className="text-sm font-semibold text-slate-700">Full Name</div>
          </div>
          <div className="flex-1 relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input" style={{ paddingLeft: '2rem' }} type="text"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
        </div>

        {/* Email — read only */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-4 border-b border-slate-100">
          <div className="sm:w-40 shrink-0">
            <div className="text-sm font-semibold text-slate-700">Email</div>
            <div className="text-xs text-slate-400 mt-0.5">Cannot be changed</div>
          </div>
          <div className="flex-1 relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input opacity-60 cursor-not-allowed" style={{ paddingLeft: '2rem' }}
              type="email" value={profile?.email || ''} readOnly />
          </div>
        </div>

        {/* Phone */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-4 border-b border-slate-100 last:border-0">
          <div className="sm:w-40 shrink-0">
            <div className="text-sm font-semibold text-slate-700">Phone Number</div>
            <div className="text-xs text-slate-400 mt-0.5">Include country code</div>
          </div>
          <div className="flex-1 relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input" style={{ paddingLeft: '2rem' }} type="tel"
              placeholder="+91 9876543210"
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>

        {/* Referral code — read only */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-4">
          <div className="sm:w-40 shrink-0">
            <div className="text-sm font-semibold text-slate-700">Referral Code</div>
            <div className="text-xs text-slate-400 mt-0.5">Share to earn rewards</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg text-sm">
              {profile?.referralCode || '—'}
            </span>
            {profile?.referralCode && (
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/register?ref=${profile.referralCode}`)}
                className="text-xs text-slate-500 hover:text-blue-600 border border-slate-200 px-2 py-1.5 rounded-lg transition-colors">
                Copy Link
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
