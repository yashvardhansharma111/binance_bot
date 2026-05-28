'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, Key, Users, BarChart2, LogOut, Zap,
  ShieldCheck, Activity, ChevronRight, LineChart,
  ArrowDownToLine, Menu, X, Crown, Settings2, Zap as Trade,
  Sun, Moon, ArrowUpRight,
} from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '@/app/ThemeContext';

const navItems = [
  { href: '/dashboard',             label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/dashboard/bot',         label: 'Bot Monitor',icon: Activity },
  { href: '/dashboard/chart',       label: 'Live Chart', icon: LineChart },
  { href: '/dashboard/trade',       label: 'Trade',      icon: Trade },
  { href: '/dashboard/trades',      label: 'History',    icon: BarChart2 },
  { href: '/dashboard/settings',    label: 'Bot Config', icon: Settings2 },
  { href: '/dashboard/deposit',     label: 'Deposit',    icon: ArrowDownToLine },
  { href: '/dashboard/subscribe',   label: 'Subscribe',  icon: Crown },
  { href: '/dashboard/apikeys',     label: 'API Keys',   icon: Key },
  { href: '/dashboard/referral',    label: 'Referral',   icon: Users },
];

function isActive(href, pathname) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
}

/* ── Theme toggle button ──────────────────────────────────────────────────── */
function ThemeToggle({ compact = false }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all"
      style={{
        color:      'var(--text-2)',
        background: 'transparent',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--accent-dim)';
        e.currentTarget.style.color      = 'var(--accent)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color      = 'var(--text-2)';
      }}
    >
      {dark
        ? <Sun  size={compact ? 16 : 15} />
        : <Moon size={compact ? 16 : 15} />}
      {!compact && <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
    </button>
  );
}

/* ── Desktop sidebar ──────────────────────────────────────────────────────── */
export function DesktopSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside
      className="hidden lg:flex w-64 min-h-screen flex-col shrink-0"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>
            TrickyX<span style={{ color: 'var(--accent)' }}>.ai</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2"
          style={{ color: 'var(--text-3)' }}>
          Navigation
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? 'var(--accent-dim)' : 'transparent',
                color:      active ? 'var(--accent)'     : 'var(--text-2)',
              }}>
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={13} style={{ opacity: 0.5 }} />}
            </Link>
          );
        })}

        {session?.user?.role === 'admin' && (
          <div className="pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2"
              style={{ color: 'var(--text-3)' }}>
              Admin
            </p>
            {[
              { href: '/admin',              label: 'Admin Panel',  icon: ShieldCheck },
              { href: '/admin/withdrawals',  label: 'Withdrawals',  icon: ArrowUpRight },
            ].map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: active ? '#fefce8' : 'transparent',
                    color:      active ? '#b45309' : 'var(--text-2)',
                  }}>
                  <Icon size={16} />
                  <span className="flex-1">{label}</span>
                  {active && <ChevronRight size={13} style={{ opacity: 0.5 }} />}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User + controls */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
          style={{ background: 'var(--surface-2)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-600 shrink-0">
            {session?.user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>
              {session?.user?.name}
            </div>
          </div>
        </div>

        <ThemeToggle />

        <button onClick={() => signOut({ callbackUrl: window.location.origin + '/' })}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors mt-0.5"
          style={{ color: 'var(--text-2)' }}
          onMouseEnter={e => {
            e.currentTarget.style.color      = '#dc2626';
            e.currentTarget.style.background = '#fef2f2';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color      = 'var(--text-2)';
            e.currentTarget.style.background = 'transparent';
          }}>
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

/* ── Mobile top bar ───────────────────────────────────────────────────────── */
export function MobileTopBar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 h-14 flex items-center justify-between"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-600">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
            TrickyX<span style={{ color: 'var(--accent)' }}>.ai</span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle compact />
          <button onClick={() => setOpen(v => !v)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-2)' }}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Slide-down drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setOpen(false)}>
          <div
            className="absolute top-14 left-0 right-0 shadow-xl px-4 py-3"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-3"
              style={{ background: 'var(--surface-2)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-600 shrink-0">
                {session?.user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                  {session?.user?.name}
                </div>
              </div>
            </div>

            {/* Nav links not in bottom tab bar */}
            <div className="mb-2">
              {[
                { href: '/dashboard/trades',    label: 'History',   icon: BarChart2 },
                { href: '/dashboard/deposit',   label: 'Deposit',   icon: ArrowDownToLine },
                { href: '/dashboard/subscribe', label: 'Subscribe', icon: Crown },
                { href: '/dashboard/apikeys',   label: 'API Keys',  icon: Key },
                { href: '/dashboard/referral',  label: 'Referral',  icon: Users },
              ].map(({ href, label, icon: Icon }) => {
                const active = isActive(href, pathname);
                return (
                  <Link key={href} href={href} onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-all"
                    style={{
                      background: active ? 'var(--accent-dim)' : 'transparent',
                      color:      active ? 'var(--accent)'     : 'var(--text-2)',
                    }}>
                    <Icon size={16} /> {label}
                  </Link>
                );
              })}
            </div>

            {session?.user?.role === 'admin' && (
              <>
                <div className="my-2" style={{ borderTop: '1px solid var(--border)' }} />
                <Link href="/admin" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-all"
                  style={{
                    background: pathname === '/admin' ? '#fefce8' : 'transparent',
                    color:      pathname === '/admin' ? '#b45309' : 'var(--text-2)',
                  }}>
                  <ShieldCheck size={16} /> Admin Panel
                </Link>
                <Link href="/admin/withdrawals" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-all"
                  style={{
                    background: pathname === '/admin/withdrawals' ? '#fefce8' : 'transparent',
                    color:      pathname === '/admin/withdrawals' ? '#b45309' : 'var(--text-2)',
                  }}>
                  <ArrowUpRight size={16} /> Withdrawals
                </Link>
              </>
            )}

            <div className="mt-2" style={{ borderTop: '1px solid var(--border)' }} />
            <button onClick={() => { signOut({ callbackUrl: window.location.origin + '/' }); setOpen(false); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full transition-colors mt-1"
              style={{ color: '#ef4444' }}>
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Mobile bottom tab bar ────────────────────────────────────────────────── */
export function MobileTabBar() {
  const pathname = usePathname();

  const tabs = [
    { href: '/dashboard',           label: 'Home',    icon: LayoutDashboard },
    { href: '/dashboard/bot',       label: 'Bot',     icon: Activity },
    { href: '/dashboard/trade',     label: 'Trade',   icon: Trade },
    { href: '/dashboard/chart',     label: 'Chart',   icon: LineChart },
    { href: '/dashboard/settings',  label: 'Config',  icon: Settings2 },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        background:    'var(--surface)',
        borderTop:     '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>
              <div className="relative">
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                {active && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--accent)' }} />
                )}
              </div>
              <span className="text-[10px] font-semibold leading-none"
                style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ── Default export ───────────────────────────────────────────────────────── */
export default function Sidebar() {
  return <DesktopSidebar />;
}
