'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Zap, Lock, Eye, EyeOff, AlertCircle, CheckCircle, RefreshCw, ShieldCheck } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const e = searchParams.get('email');
    if (e) setEmail(e);
  }, [searchParams]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function resendOtp() {
    setError('');
    setResendLoading(true);
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, purpose: 'reset' }),
    });
    setResendLoading(false);
    if (res.ok) setCountdown(60);
    else { const d = await res.json(); setError(d.error); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) return setError('Enter the 6-digit code');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirm) return setError('Passwords do not match');

    setLoading(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    setSuccess('Password reset! Redirecting to sign in...');
    setTimeout(() => router.push('/login'), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">TrickyX<span className="text-blue-600">.ai</span></span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">Reset your password</h1>
        <p className="text-slate-500 mb-8">
          Enter the code sent to <span className="font-semibold text-slate-700">{email}</span> and your new password.
        </p>

        <div className="card p-8 glow-border">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm bg-red-50 border border-red-200 text-red-600">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700">
              <CheckCircle size={15} /> {success}
            </div>
          )}

          <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 rounded-xl">
            <ShieldCheck size={18} className="text-blue-600 shrink-0" />
            <p className="text-sm text-blue-700">Code expires in 10 minutes. Check spam if not received.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">6-digit reset code</label>
              <input
                className="input text-center text-2xl font-bold tracking-[0.5em]"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input"
                  style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm new password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input"
                  style={{ paddingLeft: '2.5rem' }}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading || !!success}
              className="btn-primary w-full py-3 text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><RefreshCw size={14} className="animate-spin" /> Resetting...</> : 'Reset Password'}
            </button>
          </form>

          <div className="mt-5 text-center">
            {countdown > 0 ? (
              <p className="text-sm text-slate-400">Resend in <span className="font-semibold text-slate-600">{countdown}s</span></p>
            ) : (
              <button onClick={resendOtp} disabled={resendLoading}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold disabled:opacity-60">
                {resendLoading ? 'Sending...' : 'Resend code'}
              </button>
            )}
            <Link href="/login" className="block mt-3 text-sm text-slate-400 hover:text-slate-600">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
