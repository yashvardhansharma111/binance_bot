'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard, Key, Users, BarChart2, LogOut, Zap,
  ShieldCheck, Activity, LineChart, ArrowDownToLine,
  Menu, X, Crown, Settings2, Zap as Trade,
  Sun, Moon, ArrowUpRight, UserCircle, LifeBuoy, Globe,
} from 'lucide-react';
import { useTheme } from '@/app/ThemeContext';
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from '@/components/ui/sidebar';

const ICON = 'h-[18px] w-[18px] shrink-0';

const navItems = [
  { href: '/dashboard',           label: 'Dashboard',   Icon: LayoutDashboard },
  { href: '/dashboard/bot',       label: 'Bot Monitor', Icon: Activity },
  { href: '/dashboard/chart',     label: 'Live Chart',  Icon: LineChart },
  { href: '/dashboard/trade',     label: 'Trade',       Icon: Trade },
  { href: '/dashboard/trades',    label: 'History',     Icon: BarChart2 },
  { href: '/dashboard/settings',  label: 'Bot Config',  Icon: Settings2 },
  { href: '/dashboard/deposit',   label: 'Deposit',     Icon: ArrowDownToLine },
  { href: '/dashboard/subscribe', label: 'Subscribe',   Icon: Crown },
  { href: '/dashboard/apikeys',   label: 'API Keys',    Icon: Key },
  { href: '/dashboard/referral',  label: 'Referral',    Icon: Users },
  { href: '/dashboard/support',   label: 'Support',     Icon: LifeBuoy },
  { href: '/dashboard/profile',   label: 'Profile',     Icon: UserCircle },
];

function isActive(href, pathname) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
}

/* ── Logo: wordmark collapses with the rail ──────────────────────────────── */
function SidebarLogo() {
  const { open } = useSidebar();
  return (
    <Link href="/" className="relative z-20 flex items-center gap-2.5 px-1 py-1">
      <span className="grid size-[26px] shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500"
        style={{ boxShadow: '0 0 14px var(--accent-glow)' }}>
        <Zap size={13} className="text-black" strokeWidth={2.6} />
      </span>
      <motion.span
        animate={{ opacity: open ? 1 : 0, display: open ? 'inline-block' : 'none' }}
        className="whitespace-pre text-[15px] font-bold tracking-tight"
        style={{ color: 'var(--text-1)' }}
      >
        TrickyX<span style={{ color: 'var(--accent)' }}>.ai</span>
      </motion.span>
    </Link>
  );
}

function SectionLabel({ children }) {
  const { open } = useSidebar();
  return (
    <motion.p
      animate={{ opacity: open ? 1 : 0, height: open ? 'auto' : 0 }}
      className="overflow-hidden px-2.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
      style={{ color: 'var(--text-3)' }}
    >
      {children}
    </motion.p>
  );
}

function ThemeToggleRow() {
  const { theme, toggle } = useTheme();
  const { open } = useSidebar();
  const dark = theme === 'dark';
  return (
    <button onClick={toggle} title={dark ? 'Light mode' : 'Dark mode'}
      className="group/sidebar flex w-full items-center justify-start gap-2.5 rounded-lg px-2.5 py-2.5 transition-colors"
      style={{ color: 'var(--text-3)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      <motion.span className="shrink-0" initial={false} animate={{ rotate: dark ? 0 : 180 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
        {dark ? <Sun className={ICON} /> : <Moon className={ICON} />}
      </motion.span>
      <motion.span animate={{ opacity: open ? 1 : 0, display: open ? 'inline-block' : 'none' }}
        className="whitespace-pre text-[13.5px] font-medium">
        {dark ? 'Light Mode' : 'Dark Mode'}
      </motion.span>
    </button>
  );
}

function SignOutRow() {
  const { open } = useSidebar();
  return (
    <button onClick={() => signOut({ callbackUrl: window.location.origin + '/' })}
      className="flex w-full items-center justify-start gap-2.5 rounded-lg px-2.5 py-2.5 transition-colors"
      style={{ color: 'var(--text-3)' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'transparent'; }}>
      <LogOut className={ICON} />
      <motion.span animate={{ opacity: open ? 1 : 0, display: open ? 'inline-block' : 'none' }}
        className="whitespace-pre text-[13.5px] font-medium">
        Sign Out
      </motion.span>
    </button>
  );
}

function UserRow() {
  const { data: session } = useSession();
  const { open } = useSidebar();
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-2"
      style={{ background: open ? 'var(--surface-2)' : 'transparent', border: open ? '1px solid var(--border)' : '1px solid transparent' }}>
      <span className="grid size-[26px] shrink-0 place-items-center rounded-full text-[11px] font-bold"
        style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
        {session?.user?.name?.[0]?.toUpperCase() || 'U'}
      </span>
      <motion.span animate={{ opacity: open ? 1 : 0, display: open ? 'inline-block' : 'none' }}
        className="truncate whitespace-pre text-[13px] font-semibold"
        style={{ color: 'var(--text-1)' }}>
        {session?.user?.name}
      </motion.span>
    </div>
  );
}

/* ── Desktop sidebar (hover to expand) ───────────────────────────────────── */
export function DesktopSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const canOverview = session?.user?.canViewOverview || session?.user?.role === 'admin';
  const isAdmin = session?.user?.role === 'admin';

  const links = navItems.map(({ href, label, Icon }) => ({
    href, label,
    icon: <Icon className={ICON} />,
    active: isActive(href, pathname),
  }));

  if (canOverview) {
    links.push({
      href: '/dashboard/overview',
      label: 'Overview',
      icon: <Globe className={ICON} />,
      active: isActive('/dashboard/overview', pathname),
    });
  }

  const adminLinks = [
    { href: '/admin',             label: 'Admin Panel', icon: <ShieldCheck className={ICON} />, active: pathname === '/admin' },
    { href: '/admin/withdrawals', label: 'Withdrawals', icon: <ArrowUpRight className={ICON} />, active: pathname === '/admin/withdrawals' },
  ];

  return (
    <div className="hidden h-full lg:block">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="h-full justify-between gap-6 overflow-x-hidden">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <SidebarLogo />

            <div className="mt-7 flex flex-col gap-2">
              <SectionLabel>Navigation</SectionLabel>
              <div className="flex flex-col gap-0.5">
                {links.map((link) => <SidebarLink key={link.href} link={link} />)}
              </div>
            </div>

            {isAdmin && (
              <div className="mt-6 flex flex-col gap-2">
                <SectionLabel>Admin</SectionLabel>
                <div className="flex flex-col gap-0.5">
                  {adminLinks.map((link) => <SidebarLink key={link.href} link={link} />)}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            <UserRow />
            <ThemeToggleRow />
            <SignOutRow />
          </div>
        </SidebarBody>
      </Sidebar>
    </div>
  );
}

/* ── Mobile top bar ──────────────────────────────────────────────────────── */
export function MobileTopBar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';

  const drawerLinks = [
    { href: '/dashboard/trades',    label: 'History',   Icon: BarChart2 },
    { href: '/dashboard/deposit',   label: 'Deposit',   Icon: ArrowDownToLine },
    { href: '/dashboard/subscribe', label: 'Subscribe', Icon: Crown },
    { href: '/dashboard/apikeys',   label: 'API Keys',  Icon: Key },
    { href: '/dashboard/referral',  label: 'Referral',  Icon: Users },
    { href: '/dashboard/support',   label: 'Support',   Icon: LifeBuoy },
    { href: '/dashboard/profile',   label: 'Profile',   Icon: UserCircle },
  ];

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between px-4 lg:hidden"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(10px)' }}>
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-[24px] place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
            <Zap size={12} className="text-black" strokeWidth={2.6} />
          </span>
          <span className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
            TrickyX<span style={{ color: 'var(--accent)' }}>.ai</span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <button onClick={toggle} className="rounded-lg p-2" style={{ color: 'var(--text-3)' }}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button onClick={() => setOpen(v => !v)} className="rounded-lg p-2" style={{ color: 'var(--text-2)' }}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setOpen(false)}>
          <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 top-14 px-3 py-3 shadow-2xl"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span className="grid size-7 place-items-center rounded-full text-[11px] font-bold"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                {session?.user?.name?.[0]?.toUpperCase() || 'U'}
              </span>
              <span className="truncate text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>
                {session?.user?.name}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              {drawerLinks.map(({ href, label, Icon }, i) => {
                const active = isActive(href, pathname);
                return (
                  <motion.div key={href}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}>
                    <Link href={href} onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium"
                      style={{
                        background: active ? 'var(--accent-dim)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-2)',
                      }}>
                      <Icon size={16} /> {label}
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {(session?.user?.canViewOverview || session?.user?.role === 'admin') && (
              <>
                <div className="my-2" style={{ borderTop: '1px solid var(--border)' }} />
                <Link href="/dashboard/overview" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium"
                  style={{
                    background: pathname === '/dashboard/overview' ? 'var(--accent-dim)' : 'transparent',
                    color: pathname === '/dashboard/overview' ? 'var(--accent)' : 'var(--text-2)',
                  }}>
                  <Globe size={16} /> Overview
                </Link>
              </>
            )}

            {session?.user?.role === 'admin' && (
              <>
                <div className="my-2" style={{ borderTop: '1px solid var(--border)' }} />
                {[{ href: '/admin', label: 'Admin Panel', Icon: ShieldCheck },
                  { href: '/admin/withdrawals', label: 'Withdrawals', Icon: ArrowUpRight }].map(({ href, label, Icon }) => (
                  <Link key={href} href={href} onClick={() => setOpen(false)}
                    className="mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium"
                    style={{
                      background: pathname === href ? 'rgba(251,191,36,0.1)' : 'transparent',
                      color: pathname === href ? 'var(--warn)' : 'var(--text-2)',
                    }}>
                    <Icon size={16} /> {label}
                  </Link>
                ))}
              </>
            )}

            <div className="my-2" style={{ borderTop: '1px solid var(--border)' }} />
            <button onClick={() => { signOut({ callbackUrl: window.location.origin + '/' }); setOpen(false); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium"
              style={{ color: 'var(--danger)' }}>
              <LogOut size={15} /> Sign Out
            </button>
          </motion.div>
        </div>
      )}
    </>
  );
}

/* ── Mobile bottom tab bar ───────────────────────────────────────────────── */
export function MobileTabBar() {
  const pathname = usePathname();
  const tabs = [
    { href: '/dashboard',          label: 'Home',   Icon: LayoutDashboard },
    { href: '/dashboard/bot',      label: 'Bot',    Icon: Activity },
    { href: '/dashboard/trade',    label: 'Trade',  Icon: Trade },
    { href: '/dashboard/chart',    label: 'Chart',  Icon: LineChart },
    { href: '/dashboard/settings', label: 'Config', Icon: Settings2 },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex">
        {tabs.map(({ href, label, Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link key={href} href={href}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
              style={{ color: active ? 'var(--accent)' : 'var(--text-3)', transition: 'color 0.15s' }}>
              {active && (
                <motion.span layoutId="tabbar-active"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className="absolute inset-x-4 top-0 h-[2px] rounded-full"
                  style={{ background: 'var(--accent)' }} />
              )}
              <motion.span whileTap={{ scale: 0.86 }} className="relative">
                <Icon size={19} strokeWidth={active ? 2.3 : 1.7} />
              </motion.span>
              <span className="text-[10px] font-semibold tracking-wide"
                style={{ fontWeight: active ? 700 : 500 }}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function Sidebar_() {
  return <DesktopSidebar />;
}
