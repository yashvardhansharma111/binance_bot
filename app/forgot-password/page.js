'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, Mail, AlertCircle, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, purpose: 'reset' }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    setSent(true);
    setTimeout(() => router.push(`/reset-password?email=${encodeURIComponent(email)}`), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-8">
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">TrickyX<span className="text-blue-600">.ai</span></span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">Forgot your password?</h1>
        <p className="text-slate-500 mb-8">Enter your email and we&apos;ll send you a reset code.</p>

        <div className="card p-8 glow-border">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm bg-red-50 border border-red-200 text-red-600">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {sent && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700">
              <CheckCircle size={15} /> Code sent! Redirecting to reset page...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input"
                  style={{ paddingLeft: '2.5rem' }}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading || sent}
              className="btn-primary w-full py-3 text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><RefreshCw size={14} className="animate-spin" /> Sending...</> : 'Send Reset Code'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
