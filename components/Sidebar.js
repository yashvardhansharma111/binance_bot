'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, Key, Users, BarChart2, LogOut, Zap,
  ShieldCheck, Activity, ChevronRight, LineChart,
  ArrowDownToLine, Menu, X, Crown, Settings2, Zap as Trade,
} from 'lucide-react';
import { useState } from 'react';

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

/* ── Desktop sidebar ─────────────────────────────────────────────────────── */
export function DesktopSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="hidden lg:flex w-64 min-h-screen flex-col bg-white border-r border-slate-200 shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">
            TrickyX<span className="text-blue-600">.ai</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 mb-2">Navigation</p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? '#eff6ff' : 'transparent',
                color:      active ? '#2563eb' : '#64748b',
              }}>
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={13} className="opacity-40" />}
            </Link>
          );
        })}

        {session?.user?.role === 'admin' && (
          <div className="pt-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 mb-2">Admin</p>
            <Link href="/admin"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: pathname.startsWith('/admin') ? '#fefce8' : 'transparent',
                color:      pathname.startsWith('/admin') ? '#b45309' : '#64748b',
              }}>
              <ShieldCheck size={16} />
              <span className="flex-1">Admin Panel</span>
              {pathname.startsWith('/admin') && <ChevronRight size={13} className="opacity-40" />}
            </Link>
          </div>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 bg-slate-50">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-600 shrink-0">
            {session?.user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{session?.user?.name}</div>
            <div className="text-xs text-slate-400 truncate">{session?.user?.email}</div>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 w-full transition-colors mt-0.5">
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

/* ── Mobile top bar ──────────────────────────────────────────────────────── */
export function MobileTopBar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-600">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-base font-bold text-slate-900">
            TrickyX<span className="text-blue-600">.ai</span>
          </span>
        </Link>
        <button onClick={() => setOpen(v => !v)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Slide-down drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setOpen(false)}>
          <div className="absolute top-14 left-0 right-0 bg-white border-b border-slate-200 shadow-xl px-4 py-3"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-3 bg-slate-50">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-600 shrink-0">
                {session?.user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{session?.user?.name}</div>
                <div className="text-xs text-slate-400 truncate">{session?.user?.email}</div>
              </div>
            </div>

            {session?.user?.role === 'admin' && (
              <Link href="/admin" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-2 transition-all"
                style={{
                  background: pathname.startsWith('/admin') ? '#fefce8' : 'transparent',
                  color:      pathname.startsWith('/admin') ? '#b45309' : '#64748b',
                }}>
                <ShieldCheck size={16} /> Admin Panel
              </Link>
            )}

            <button onClick={() => { signOut({ callbackUrl: '/' }); setOpen(false); }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 w-full transition-colors">
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Mobile bottom tab bar ───────────────────────────────────────────────── */
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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{ color: active ? '#2563eb' : '#94a3b8' }}>
              <div className="relative">
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                {active && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                )}
              </div>
              <span className="text-[10px] font-semibold leading-none"
                style={{ color: active ? '#2563eb' : '#94a3b8' }}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ── Default export (kept for any direct imports) ────────────────────────── */
export default function Sidebar() {
  return <DesktopSidebar />;
}
