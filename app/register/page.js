'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Zap, Mail, Lock, User, Eye, EyeOff, AlertCircle,
  CheckCircle, Hash, ShieldCheck, RefreshCw, Wand2, Check, X, Copy,
} from 'lucide-react';
import { PASSWORD_RULES, validatePassword, generatePassword } from '@/lib/passwordUtils';

function StrengthChecklist({ password }) {
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      {PASSWORD_RULES.map(rule => {
        const pass = rule.test(password);
        return (
          <div key={rule.id} className="flex items-center gap-1.5 text-xs">
            {pass
              ? <Check size={11} className="text-emerald-500 shrink-0" />
              : <X     size={11} className="text-red-400 shrink-0" />}
            <span className={pass ? 'text-emerald-600' : 'text-slate-400'}>{rule.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RegisterForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [step,       setStep]       = useState(1);
  const [form,       setForm]       = useState({ name: '', email: '', password: '', referralCode: '' });
  const [otp,        setOtp]        = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [countdown,  setCountdown]  = useState(0);
  const [copied,     setCopied]     = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setForm(f => ({ ...f, referralCode: ref }));
  }, [searchParams]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function handleGenerate() {
    const pwd = generatePassword(14);
    setForm(f => ({ ...f, password: pwd }));
    setShowPass(true);
  }

  function handleCopy() {
    if (!form.password) return;
    navigator.clipboard.writeText(form.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function sendOtp(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return setError('Please fill all required fields');
    const { valid, failures } = validatePassword(form.password);
    if (!valid) return setError(`Password must include: ${failures.map(f => f.label).join(', ')}`);
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...form }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    setSuccess(`Account created! Referral code: ${data.referralCode}`);
    setTimeout(() => router.push('/login'), 2500);
  }

  const { valid: pwdValid } = validatePassword(form.password);
  const strengthCount = PASSWORD_RULES.filter(r => r.test(form.password)).length;
  const strengthColor = strengthCount <= 2 ? '#ef4444' : strengthCount <= 3 ? '#f59e0b' : strengthCount === 4 ? '#3b82f6' : '#10b981';

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
                {success && (
                  <div className="flex items-center gap-2 p-3 rounded-lg mb-5 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700">
                    <CheckCircle size={15} /> {success}
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

                  {/* Password with generate + copy */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-slate-700">Password</label>
                      <div className="flex gap-1.5">
                        {form.password && (
                          <button type="button" onClick={handleCopy}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded border border-slate-200 hover:border-slate-300 transition-all">
                            <Copy size={11} /> {copied ? 'Copied!' : 'Copy'}
                          </button>
                        )}
                        <button type="button" onClick={handleGenerate}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 transition-all font-medium">
                          <Wand2 size={11} /> Generate
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input font-mono" style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
                        type={showPass ? 'text' : 'password'} placeholder="Min 8 chars, mixed case, number, symbol"
                        value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {/* Strength bar */}
                    {form.password && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1.5">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className="h-1 flex-1 rounded-full transition-all"
                              style={{ background: i <= strengthCount ? strengthColor : '#e2e8f0' }} />
                          ))}
                        </div>
                        <StrengthChecklist password={form.password} />
                      </div>
                    )}
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

                  <button type="submit" disabled={loading || !pwdValid}
                    className="btn-primary w-full py-3 text-sm mt-1 disabled:opacity-60 flex items-center justify-center gap-2">
                    {loading ? <><RefreshCw size={14} className="animate-spin" /> Creating account...</> : 'Create Account'}
                  </button>
                </form>

                <p className="text-center text-slate-500 text-sm mt-6">
                  Already have an account?{' '}
                  <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">Sign in</Link>
                </p>
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
