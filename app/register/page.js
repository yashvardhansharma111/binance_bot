'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Zap, Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle, Hash, ShieldCheck, RefreshCw } from 'lucide-react';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1); // 1=form, 2=otp
  const [form, setForm] = useState({ name: '', email: '', password: '', referralCode: '' });
  const [otp, setOtp] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setForm(f => ({ ...f, referralCode: ref }));
  }, [searchParams]);

  // Resend countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function sendOtp(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return setError('Please fill all required fields');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setError('');
    setOtpLoading(true);
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, purpose: 'signup' }),
    });
    const data = await res.json();
    setOtpLoading(false);
    if (!res.ok) return setError(data.error);
    setStep(2);
    setCountdown(60);
  }

  async function resendOtp() {
    setError('');
    setOtpLoading(true);
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, purpose: 'signup' }),
    });
    setOtpLoading(false);
    if (res.ok) setCountdown(60);
    else { const d = await res.json(); setError(d.error); }
  }

  async function handleVerify(e) {
    e.preventDefault();
    if (otp.length !== 6) return setError('Enter the 6-digit code');
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, otp }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    setSuccess(`Account created! Referral code: ${data.referralCode}`);
    setTimeout(() => router.push('/login'), 2500);
  }

  const leftPanel = (
    <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 flex-col justify-between p-12">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/20">
          <Zap size={16} className="text-white" />
        </div>
        <span className="text-lg font-bold text-white">TrickyX.ai</span>
      </Link>
      <div>
        <h2 className="text-4xl font-extrabold text-white mb-4 leading-tight">
          Start earning<br />in minutes.
        </h2>
        <p className="text-blue-200 text-lg leading-relaxed">
          Create your free account and activate the AI trading bot.
          No KYC, no credit card required.
        </p>
      </div>
      <p className="text-blue-300 text-sm">&copy; 2026 TrickyX.ai</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {leftPanel}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">TrickyX<span className="text-blue-600">.ai</span></span>
          </div>

          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
              <p className="text-slate-500 mb-8">Start trading with AI in minutes</p>

              <div className="card p-8 glow-border">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm bg-red-50 border border-red-200 text-red-600">
                    <AlertCircle size={15} /> {error}
                  </div>
                )}

                <form onSubmit={sendOtp} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input" style={{ paddingLeft: '2.5rem' }} type="text" placeholder="John Doe"
                        value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input" style={{ paddingLeft: '2.5rem' }} type="email" placeholder="you@example.com"
                        value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input" style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
                        type={showPass ? 'text' : 'password'} placeholder="Min 6 characters"
                        value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Referral Code <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input" style={{ paddingLeft: '2.5rem' }} type="text" placeholder="ABCD1234"
                        value={form.referralCode} onChange={e => setForm({ ...form, referralCode: e.target.value.toUpperCase() })} />
                    </div>
                  </div>

                  <button type="submit" disabled={otpLoading}
                    className="btn-primary w-full py-3 text-sm mt-1 disabled:opacity-60 flex items-center justify-center gap-2">
                    {otpLoading ? <><RefreshCw size={14} className="animate-spin" /> Sending code...</> : 'Send Verification Code'}
                  </button>
                </form>

                <p className="text-center text-slate-500 text-sm mt-6">
                  Already have an account?{' '}
                  <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">Sign in</Link>
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Verify your email</h1>
              <p className="text-slate-500 mb-8">
                We sent a 6-digit code to <span className="font-semibold text-slate-700">{form.email}</span>
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

                <div className="flex items-center justify-center gap-3 mb-6 p-4 bg-blue-50 rounded-xl">
                  <ShieldCheck size={20} className="text-blue-600 shrink-0" />
                  <p className="text-sm text-blue-700">Check your inbox — code expires in 10 minutes</p>
                </div>

                <form onSubmit={handleVerify} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">6-digit verification code</label>
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

                  <button type="submit" disabled={loading || otp.length !== 6}
                    className="btn-primary w-full py-3 text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                    {loading ? <><RefreshCw size={14} className="animate-spin" /> Creating account...</> : 'Verify & Create Account'}
                  </button>
                </form>

                <div className="mt-5 text-center">
                  {countdown > 0 ? (
                    <p className="text-sm text-slate-400">Resend code in <span className="font-semibold text-slate-600">{countdown}s</span></p>
                  ) : (
                    <button onClick={resendOtp} disabled={otpLoading}
                      className="text-sm text-blue-600 hover:text-blue-700 font-semibold disabled:opacity-60">
                      {otpLoading ? 'Sending...' : 'Resend code'}
                    </button>
                  )}
                  <button onClick={() => { setStep(1); setError(''); setOtp(''); }}
                    className="block mx-auto mt-3 text-sm text-slate-400 hover:text-slate-600">
                    ← Change email
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
