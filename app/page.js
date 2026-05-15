'use client';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { TrendingUp, Shield, Users, Zap, BarChart2, ArrowRight, Bot, Lock, Globe, CheckCircle } from 'lucide-react';

const stats = [
  { label: 'Active Traders', value: '2,400+' },
  { label: 'Trades Executed', value: '1.2M+' },
  { label: 'Avg Monthly ROI', value: '12–18%' },
  { label: 'Uptime', value: '99.9%' },
];

const features = [
  {
    icon: Bot,
    title: 'AI Trading Bot',
    desc: '24/7 automated trading using smart algorithms. Your bot never sleeps.',
    color: '#2563eb',
    bg: '#eff6ff',
  },
  {
    icon: Shield,
    title: 'Non-Custodial',
    desc: 'Your funds stay in your Binance account. We only trade, never withdraw.',
    color: '#0891b2',
    bg: '#ecfeff',
  },
  {
    icon: Users,
    title: 'Referral Rewards',
    desc: 'Earn commissions on every trade made by users you refer. Unlimited referrals.',
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
  {
    icon: Lock,
    title: 'Military-Grade Security',
    desc: 'API keys encrypted with AES-256. Trading-only permissions, no withdrawals.',
    color: '#b45309',
    bg: '#fefce8',
  },
  {
    icon: BarChart2,
    title: 'Live Analytics',
    desc: 'Real-time P&L tracking, trade history, and performance reports.',
    color: '#16a34a',
    bg: '#f0fdf4',
  },
  {
    icon: Globe,
    title: 'Binance Integrated',
    desc: 'Direct integration with Binance. Real-time market data and order execution.',
    color: '#0ea5e9',
    bg: '#f0f9ff',
  },
];

const steps = [
  { num: '01', title: 'Create Account', desc: 'Sign up in seconds. No KYC required to get started.' },
  { num: '02', title: 'Connect Binance', desc: 'Link your Binance API key securely. Trading-only access.' },
  { num: '03', title: 'Activate Bot', desc: 'Set your fund balance and activate the AI trading bot.' },
  { num: '04', title: 'Earn & Refer', desc: 'Watch profits grow and earn more by referring friends.' },
];

const perks = [
  'No credit card required',
  'Your funds stay in your account',
  'Cancel anytime',
];

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">TrickyX<span className="text-blue-600">.ai</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how" className="hover:text-slate-900 transition-colors">How It Works</a>
            <a href="#stats" className="hover:text-slate-900 transition-colors">Stats</a>
          </div>
          <div className="flex items-center gap-3">
            {session ? (
              <Link href="/dashboard" className="btn-primary text-sm py-2 px-5">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="btn-outline text-sm py-2 px-5">Sign In</Link>
                <Link href="/register" className="btn-primary text-sm py-2 px-5">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-8 bg-blue-50 text-blue-700 border border-blue-100">
            <Zap size={13} />
            AI-Powered Crypto Trading
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6 text-slate-900">
            Trade Smarter with{' '}
            <span className="gradient-text">TrickyX.ai</span>
          </h1>

          <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect your Binance account, activate the AI bot, and earn passive income 24/7.
            Earn referral rewards for every trader you bring in.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href="/register"
              className="btn-primary text-base py-3.5 px-8 inline-flex items-center gap-2 justify-center">
              Start Trading Free <ArrowRight size={17} />
            </Link>
            <Link href="/login" className="btn-outline text-base py-3.5 px-8">
              Sign In
            </Link>
          </div>

          <div className="flex items-center justify-center gap-6 text-sm text-slate-400">
            {perks.map(p => (
              <span key={p} className="flex items-center gap-1.5">
                <CheckCircle size={13} className="text-emerald-500" /> {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="py-16 px-6 bg-blue-600">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-extrabold text-white mb-1">{s.value}</div>
              <div className="text-blue-200 text-sm font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-extrabold mb-4 text-slate-900">
              Everything You Need to <span className="gradient-text">Win</span>
            </h2>
            <p className="text-slate-500 text-lg">Built for traders who want results, not complexity.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="card p-6 glow-border hover:shadow-md transition-shadow">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: f.bg }}>
                    <Icon size={20} style={{ color: f.color }} />
                  </div>
                  <h3 className="text-base font-bold mb-2 text-slate-900">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-extrabold mb-4 text-slate-900">
              How It <span className="gradient-text">Works</span>
            </h2>
            <p className="text-slate-500 text-lg">Up and running in under 5 minutes.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={step.num} className="relative">
                <div className="card p-6 text-center glow-border h-full">
                  <div className="text-4xl font-extrabold gradient-text opacity-60 mb-3">{step.num}</div>
                  <h3 className="font-bold mb-2 text-slate-900">{step.title}</h3>
                  <p className="text-slate-500 text-sm">{step.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 z-10">
                    <ArrowRight size={18} className="text-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-extrabold mb-4 text-white">
            Ready to let AI trade for you?
          </h2>
          <p className="text-blue-200 mb-8 text-lg">Join thousands of traders already using TrickyX.ai.</p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold py-3.5 px-10 rounded-lg hover:bg-blue-50 transition-colors text-base">
            Create Free Account <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6 bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-blue-600">
              <Zap size={12} className="text-white" />
            </div>
            <span className="font-bold text-slate-700">TrickyX.ai</span>
          </div>
          <p className="text-slate-400 text-sm">
            &copy; 2026 TrickyX.ai. Trading involves risk. Past performance does not guarantee future results.
          </p>
        </div>
      </footer>
    </div>
  );
}
