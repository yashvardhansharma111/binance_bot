'use client';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { GlowingEffect } from '@/components/ui/glowing-effect';

/** Full-screen grid background + glowing card, shared by login / register. */
export function AuthShell({ title, subtitle, children, footer, badge, maxWidth = 'max-w-md' }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-12">
      {/* grid */}
      <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.085)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.085)_1px,transparent_1px)] [background-size:38px_38px]" />
      {/* darken toward the edges so the grid reads as depth, not wallpaper */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_58%_52%_at_50%_45%,transparent_5%,rgba(0,0,0,0.82)_70%,#000_100%)]" />
      {/* emerald pool behind the card */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[min(760px,110vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.09] blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className={`relative z-10 w-full ${maxWidth}`}
      >
        <Link href="/" className="mb-7 flex items-center justify-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]">
            <Zap size={16} className="text-black" strokeWidth={2.6} />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-neutral-100">
            TrickyX<span className="text-emerald-400">.ai</span>
          </span>
        </Link>

        <div className="mb-6 text-center">
          {badge && <div className="mb-3 flex justify-center">{badge}</div>}
          <h1 className="mb-2 bg-gradient-to-b from-white to-white/55 bg-clip-text text-[26px] font-extrabold tracking-[-0.03em] text-transparent sm:text-[30px]">
            {title}
          </h1>
          {subtitle && <p className="text-[14px] text-neutral-500">{subtitle}</p>}
        </div>

        {/* glowing-edge card */}
        <div className="relative rounded-2xl border border-white/[0.09] p-[1px]">
          <GlowingEffect spread={46} glow proximity={90} inactiveZone={0.01} borderWidth={2} disabled={false} />
          <div className="relative rounded-2xl bg-neutral-950/85 p-6 backdrop-blur-xl sm:p-7">
            {children}
          </div>
        </div>

        {footer && <div className="mt-6 text-center text-[13.5px] text-neutral-500">{footer}</div>}

        <p className="mt-8 text-center text-[11.5px] text-neutral-700">
          Trade-only API keys · AES-256 encrypted · funds never leave your account
        </p>
      </motion.div>
    </div>
  );
}

/** Dark-theme alert chip. The pages previously used bg-red-50 / bg-amber-50,
 *  which are light pastels that are unreadable on this background. */
export function AuthAlert({ tone = 'error', icon: Icon, children }) {
  const tones = {
    error:   { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.28)',  color: '#fca5a5' },
    warn:    { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.28)', color: '#fcd34d' },
    success: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.28)', color: '#6ee7b7' },
  };
  const t = tones[tone] ?? tones.error;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-5 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px]"
      style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.color }}
    >
      {Icon && <Icon size={15} className="shrink-0" />}
      <span>{children}</span>
    </motion.div>
  );
}
