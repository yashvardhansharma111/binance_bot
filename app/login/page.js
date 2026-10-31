'use client';
import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, MonitorSmartphone, ArrowRight, RefreshCw } from 'lucide-react';
import { AuthShell, AuthAlert } from '@/components/ui/auth-shell';
import MetaMaskButton from '@/components/MetaMaskButton';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session_expired';

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) return setError('Invalid email or password');
    router.push('/dashboard');
  }

  return (
    <>
      {sessionExpired && (
        <AuthAlert tone="warn" icon={MonitorSmartphone}>
          You were signed in on another device. Please log in again.
        </AuthAlert>
      )}
      {error && <AuthAlert tone="error" icon={AlertCircle}>{error}</AuthAlert>}

      <MetaMaskButton callbackUrl="/dashboard" />

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-600">or</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-neutral-300">Email address</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              className="input"
              style={{ paddingLeft: '2.5rem' }}
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-neutral-300">Password</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              className="input"
              style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
              type={showPass ? 'text' : 'password'}
              placeholder="Enter your password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-600 transition-colors hover:text-neutral-300">
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="-mt-2 flex justify-end">
          <Link href="/forgot-password" className="text-[13px] font-medium text-emerald-400 transition-colors hover:text-emerald-300">
            Forgot password?
          </Link>
        </div>

        <motion.button type="submit" disabled={loading}
          whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }}
          className="group relative mt-1 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-3 text-[14px] font-semibold text-black transition disabled:opacity-60"
          style={{ boxShadow: '0 8px 28px -8px rgba(16,185,129,0.55)' }}>
          <span className="relative z-10 inline-flex items-center gap-2">
            {loading
              ? <><RefreshCw size={14} className="animate-spin" /> Signing in…</>
              : <>Sign In <ArrowRight size={15} /></>}
          </span>
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        </motion.button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your trading account"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-emerald-400 transition-colors hover:text-emerald-300">
            Create one
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="py-8 text-center text-[13px] text-neutral-600">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
