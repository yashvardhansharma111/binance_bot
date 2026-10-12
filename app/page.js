'use client';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowRight, Zap, Bot, Shield, Users, BarChart3,
  Globe, Check, Sparkles, Cpu, Activity, Lock, Camera, X,
} from 'lucide-react';

import { FloatingNav } from '@/components/ui/floating-navbar';
import { Spotlight } from '@/components/ui/spotlight-new';
import { LampContainer } from '@/components/ui/lamp';
import { EvervaultCard } from '@/components/ui/evervault-card';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { FlipWords } from '@/components/ui/flip-words';
import { Timeline } from '@/components/ui/timeline';
import { InfiniteMovingCards } from '@/components/ui/infinite-moving-cards';
import { BackgroundBeamsWithCollision } from '@/components/ui/background-beams-with-collision';
import { ImageGenerationLoader } from '@/components/ui/image-generation-loader';
import { MacbookHero } from '@/components/ui/macbook-hero';
import { WebcamPixelGrid } from '@/components/ui/webcam-pixel-grid';
import WorldMap from '@/components/ui/world-map';

// three.js is heavy and touches window — load it client-side only.
const World = dynamic(() => import('@/components/ui/globe').then((m) => m.World), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="size-44 animate-pulse rounded-full border border-emerald-500/20 bg-emerald-500/[0.04]" />
    </div>
  ),
});
import { BinanceLogo, BingXLogo, BinanceMark, BingXMark } from '@/components/ui/exchange-logos';
import { motion, useScroll, useMotionValueEvent } from 'motion/react';

/* ──────────────────────────────────────────────────────────── data ───────── */
const prices = [
  { s: 'BTC',   p: '67,234.50', c: '+2.31', up: 1 },
  { s: 'ETH',   p: '2,707.18',  c: '+1.84', up: 1 },
  { s: 'SOL',   p: '118.97',    c: '-0.43', up: 0 },
  { s: 'BNB',   p: '588.42',    c: '+1.12', up: 1 },
  { s: 'XRP',   p: '1.4982',    c: '-1.21', up: 0 },
  { s: 'AVAX',  p: '42.18',     c: '+0.78', up: 1 },
  { s: 'DOGE',  p: '0.1784',    c: '+3.10', up: 1 },
  { s: 'PENGU', p: '0.00961',   c: '+5.43', up: 1 },
  { s: 'LINK',  p: '23.41',     c: '+1.95', up: 1 },
  { s: 'ADA',   p: '0.8832',    c: '-0.67', up: 0 },
];

const testimonials = [
  { quote: "Set it up on a Sunday, forgot about it, came back Friday to 14 closed trades and a green balance. The trailing stop saved me twice.", name: 'Rahul M.', title: 'Running since Jan 2026' },
  { quote: "What sold me was the log. Every entry shows the RSI, the EMA state and why it passed the gate. No black box.", name: 'Priya S.', title: 'Spot + Futures' },
  { quote: "The macro bear gate kept it flat through the February dip while my manual positions bled. That alone paid for the year.", name: 'Daniel K.', title: 'Pro subscriber' },
  { quote: "Referral commission now covers my subscription three times over. Genuinely passive on top of passive.", name: 'Aisha T.', title: '38 referrals' },
  { quote: "I was sceptical about API keys until I read that withdrawal permission isn't even requested. Funds never left Binance.", name: 'Marco V.', title: 'Non-custodial convert' },
];

/* ──────────────────────────────────────────── hero signal card ──────────── */
function SignalCard() {
  const rows = [['RSI', '42.3', '#f1f5f9'], ['EMA', '↑ Bull', '#34d399'], ['MACD', 'Cross', '#34d399'], ['Vol', '1.8×', '#f1f5f9']];
  return (
    <div className="relative w-full max-w-[320px] rounded-2xl border border-white/10 bg-neutral-950/70 p-[1px] backdrop-blur-sm"
      style={{ boxShadow: '0 40px 100px -24px rgba(16,185,129,0.35)' }}>
      <GlowingEffect spread={44} glow proximity={70} inactiveZone={0.01} borderWidth={2} disabled={false} />
      <div className="relative rounded-2xl bg-neutral-950/90 px-6 py-6">
        <div className="mb-5 flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]" />
            <span className="text-[10px] font-bold tracking-[0.14em] text-neutral-500">LIVE SIGNAL</span>
          </span>
          <span className="font-mono text-[11px] text-neutral-500">BTC/USDT</span>
        </div>

        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="text-[38px] font-extrabold leading-none tracking-tight text-emerald-400">BUY</div>
            <div className="mt-1.5 text-[11px] text-neutral-600">Aggressive mode</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[19px] font-semibold text-neutral-100">$67,234</div>
            <div className="mt-1 font-mono text-xs text-emerald-400">▲ 2.31%</div>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11.5px]">
            {rows.map(([k, v, col]) => (
              <span key={k} className="text-neutral-600">
                {k} <strong className="font-semibold" style={{ color: col }}>{v}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-[7px] flex justify-between">
            <span className="text-[11px] text-neutral-600">AI confidence</span>
            <span className="font-mono text-[11px] font-bold text-emerald-400">87%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-cyan-400" style={{ width: '87%' }} />
          </div>
        </div>

        <div className="flex justify-between border-t border-white/[0.06] pt-3.5 font-mono text-[11.5px]">
          <span className="text-red-400">SL $65,800</span>
          <span className="text-emerald-400">TP $72,600</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────── bento card ─────────────── */
function BentoCard({ icon: Icon, tag, title, desc, visual, className = '' }) {
  return (
    <div className={`relative rounded-2xl border border-white/10 p-[1px] ${className}`}>
      <GlowingEffect spread={40} glow proximity={64} inactiveZone={0.01} borderWidth={2} disabled={false} />
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-neutral-950 px-7 pb-7 pt-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
            <Icon size={16} className="text-emerald-400" />
          </span>
          <span className="text-[10.5px] font-bold tracking-[0.13em] text-neutral-600">{tag}</span>
        </div>
        <h3 className="mb-2.5 text-[19px] font-semibold leading-snug tracking-tight text-neutral-100">{title}</h3>
        <p className="text-sm leading-relaxed text-neutral-400">{desc}</p>
        {visual}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────── visuals ─────────────── */
function ChartVisual() {
  const bars = [38, 52, 44, 68, 58, 82, 72, 94, 86, 108, 98, 124];
  return (
    <div className="mt-6 flex h-32 items-end gap-1.5">
      {bars.map((h, i) => (
        <motion.div key={i}
          initial={{ height: 0, opacity: 0 }}
          whileInView={{ height: h, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 rounded-t border-t-[1.5px] border-emerald-400/75"
          style={{ background: `linear-gradient(180deg, rgba(16,185,129,${0.3 + i * 0.05}), rgba(34,211,238,0.05))` }}
        />
      ))}
    </div>
  );
}

function OrbitVisual() {
  return (
    <div className="relative mt-6 grid h-32 place-items-center">
      {[54, 84, 114].map((d, i) => (
        <div key={d}
          className="absolute rounded-full border border-dashed border-emerald-500/20"
          style={{
            width: d, height: d,
            animation: `spin-slow ${7 + i * 4}s linear infinite ${i % 2 ? 'reverse' : 'normal'}`,
          }}>
          <span className="absolute -top-[3px] left-1/2 -ml-[3px] h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_9px_#10b981]" />
        </div>
      ))}
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-[0_0_28px_rgba(16,185,129,0.55)]">
        <Cpu size={19} className="text-black" />
      </div>
    </div>
  );
}

function SparkVisual() {
  return (
    <div className="relative mt-6 h-32">
      <svg viewBox="0 0 220 110" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,88 L26,74 L52,80 L78,56 L104,62 L130,38 L156,44 L182,22 L208,8 L220,4 L220,110 L0,110 Z" fill="url(#sg)" />
        <motion.path
          d="M0,88 L26,74 L52,80 L78,56 L104,62 L130,38 L156,44 L182,22 L208,8 L220,4"
          fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }}
          viewport={{ once: true }} transition={{ duration: 1.6, ease: 'easeInOut' }}
        />
        {[[130, 38], [182, 22], [220, 4]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="3.5" fill="#34d399" className="ace-sparkle"
            style={{ animationDelay: `${i * 0.6}s` }} />
        ))}
      </svg>
    </div>
  );
}

/* ──────────────────────────── candlestick chart (deterministic) ─────────── */
// BTCUSDT 5m — pullback then partial recovery, closing at the 67,234 quoted above.
const CANDLES = [
  [66400, 66520, 66350, 66480], [66480, 66600, 66440, 66560], [66560, 66580, 66300, 66340],
  [66340, 66420, 66200, 66250], [66250, 66300, 66050, 66100], [66100, 66280, 66080, 66240],
  [66240, 66350, 66190, 66320], [66320, 66330, 66100, 66140], [66140, 66200, 65900, 65950],
  [65950, 66000, 65750, 65800], [65800, 66100, 65780, 66060], [66060, 66240, 66020, 66200],
  [66200, 66400, 66170, 66370], [66370, 66420, 66250, 66290], [66290, 66500, 66270, 66470],
  [66470, 66700, 66450, 66660], [66660, 66720, 66540, 66580], [66580, 66800, 66560, 66770],
  [66770, 67000, 66740, 66960], [66960, 67050, 66850, 66900], [66900, 67120, 66880, 67090],
  [67090, 67300, 67060, 67260], [67260, 67320, 67120, 67170], [67170, 67400, 67150, 67370],
  [67370, 67560, 67340, 67520], [67520, 67600, 67400, 67450], [67450, 67560, 67380, 67410],
  [67410, 67450, 67100, 67140], [67140, 67220, 67080, 67190], [67190, 67290, 67160, 67234],
];

function CandlestickChart() {
  const W = 600, H = 420, padT = 18, padB = 26, padR = 54;
  const lows = CANDLES.map(c => c[2]);
  const highs = CANDLES.map(c => c[1]);
  const lo = Math.min(...lows) - 40;
  const hi = Math.max(...highs) + 40;
  const y = (p) => padT + ((hi - p) / (hi - lo)) * (H - padT - padB);
  const slot = (W - padR) / CANDLES.length;
  const bodyW = slot * 0.58;

  // EMA20 overlay across closes
  const closes = CANDLES.map(c => c[3]);
  const k = 2 / 21;
  let ema = closes.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  const emaPts = closes.map((c, i) => {
    ema = i === 0 ? ema : c * k + ema * (1 - k);
    return `${i * slot + slot / 2},${y(ema)}`;
  });

  const gridLines = [0.2, 0.4, 0.6, 0.8].map(f => lo + (hi - lo) * f);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="size-full" preserveAspectRatio="none">
      {gridLines.map((p, i) => (
        <g key={i}>
          <line x1="0" x2={W - padR} y1={y(p)} y2={y(p)} stroke="rgba(255,255,255,0.055)" strokeWidth="1" />
          <text x={W - padR + 8} y={y(p) + 3.5} fill="rgba(255,255,255,0.28)" fontSize="10" fontFamily="monospace">
            {Math.round(p / 100) / 10}k
          </text>
        </g>
      ))}

      <polyline points={emaPts.join(' ')} fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="1.5" strokeLinejoin="round" />

      {CANDLES.map(([o, h, l, c], i) => {
        const up = c >= o;
        const col = up ? '#10b981' : '#f43f5e';
        const cx = i * slot + slot / 2;
        const top = y(Math.max(o, c));
        const bot = y(Math.min(o, c));
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={y(h)} y2={y(l)} stroke={col} strokeWidth="1.1" opacity="0.75" />
            <rect x={cx - bodyW / 2} y={top} width={bodyW} height={Math.max(1.5, bot - top)}
              fill={col} opacity={up ? 0.88 : 0.82} rx="0.5" />
          </g>
        );
      })}

      <line x1="0" x2={W - padR} y1={y(67234)} y2={y(67234)}
        stroke="rgba(16,185,129,0.55)" strokeWidth="1" strokeDasharray="4 3" />
      <rect x={W - padR + 2} y={y(67234) - 8} width="48" height="16" rx="3" fill="#10b981" />
      <text x={W - padR + 6} y={y(67234) + 3.5} fill="#04060a" fontSize="9.5" fontWeight="700" fontFamily="monospace">
        67,234
      </text>
    </svg>
  );
}

/* ─────────────────────── dashboard shown inside the Macbook lid ─────────── */
function DashboardScreen() {
  const nav = [
    ['Dashboard', 1], ['Bot Monitor', 0], ['Live Chart', 0], ['Trade', 0],
    ['History', 0], ['Bot Config', 0], ['Referral', 0], ['API Keys', 0],
  ];
  const stats = [
    ['USDT Balance', '$4,182.60', 'text-neutral-100'],
    ['Total Profit', '+$913.44', 'text-emerald-400'],
    ['Open Trades', '5', 'text-neutral-100'],
    ['Win Rate', '68.4%', 'text-emerald-400'],
  ];
  const positions = [
    ['BTCUSDT', 'BUY', '67,234', '+2.31%', 1],
    ['ETHUSDT', 'BUY', '2,707', '+1.84%', 1],
    ['SOLUSDT', 'BUY', '118.97', '-0.43%', 0],
    ['XRPUSDT', 'BUY', '1.4982', '-1.21%', 0],
    ['PENGUUSDT', 'BUY', '0.00961', '+5.43%', 1],
  ];
  const spark = [26, 30, 24, 36, 32, 44, 38, 52, 46, 60, 54, 68, 62, 76, 70, 84];

  return (
    <div className="flex h-full w-full bg-[#06060b] text-[6px] leading-none">
      {/* sidebar */}
      <div className="flex w-[21%] shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a12] p-2">
        <div className="mb-3 flex items-center gap-1.5">
          <span className="grid size-3 place-items-center rounded bg-gradient-to-br from-emerald-500 to-cyan-500">
            <svg viewBox="0 0 24 24" className="size-2 text-black" fill="currentColor">
              <path d="M13 2 4.5 13.5H10l-1 8.5 8.5-11.5H12l1-8.5Z" />
            </svg>
          </span>
          <span className="text-[6.5px] font-bold text-neutral-100">TrickyX<span className="text-emerald-400">.ai</span></span>
        </div>
        <div className="mb-1 text-[4.5px] font-bold tracking-wider text-neutral-700">NAVIGATION</div>
        <div className="flex flex-col gap-[3px]">
          {nav.map(([label, active]) => (
            <div key={label}
              className={`flex items-center gap-1.5 rounded px-1.5 py-[3px] ${active ? 'bg-emerald-500/10 text-emerald-400' : 'text-neutral-600'}`}>
              <span className={`size-[3px] rounded-sm ${active ? 'bg-emerald-400' : 'bg-neutral-700'}`} />
              {label}
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-1.5 rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-1">
          <span className="grid size-3 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-[4.5px] font-bold text-black">R</span>
          <span className="text-[5.5px] text-neutral-300">Rahul M.</span>
        </div>
      </div>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2.5">
        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] font-bold tracking-tight text-neutral-100">Dashboard</div>
            <div className="mt-[3px] text-[5.5px] text-neutral-600">Bot active · next tick in 2m 14s</div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-[3px] text-[5.5px] font-semibold text-emerald-400">
              <span className="size-[3px] rounded-full bg-emerald-400" /> RUNNING
            </span>
            <span className="rounded bg-neutral-800 px-1.5 py-[3px] text-[5.5px] text-neutral-400">Stop Bot</span>
          </div>
        </div>

        {/* stat row */}
        <div className="grid grid-cols-4 gap-1.5">
          {stats.map(([k, v, cls]) => (
            <div key={k} className="rounded border border-white/[0.07] bg-white/[0.025] px-1.5 py-1.5">
              <div className="text-[4.5px] font-semibold tracking-wide text-neutral-600">{k.toUpperCase()}</div>
              <div className={`mt-1 text-[8px] font-bold tracking-tight ${cls}`}>{v}</div>
            </div>
          ))}
        </div>

        {/* chart + exchange panel */}
        <div className="grid min-h-0 flex-1 grid-cols-[1.6fr_1fr] gap-1.5">
          <div className="flex flex-col rounded border border-white/[0.07] bg-white/[0.025] p-1.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[5.5px] font-semibold text-neutral-300">Equity curve · 30d</span>
              <span className="text-[5.5px] font-semibold text-emerald-400">+22.4%</span>
            </div>
            <svg viewBox="0 0 200 70" className="h-full w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon fill="url(#eq)"
                points={`0,70 ${spark.map((v, i) => `${(i / (spark.length - 1)) * 200},${70 - v * 0.72}`).join(' ')} 200,70`} />
              <polyline fill="none" stroke="#34d399" strokeWidth="1.6" strokeLinejoin="round"
                points={spark.map((v, i) => `${(i / (spark.length - 1)) * 200},${70 - v * 0.72}`).join(' ')} />
            </svg>
          </div>

          <div className="flex flex-col gap-1.5 rounded border border-white/[0.07] bg-white/[0.025] p-1.5">
            <span className="text-[5.5px] font-semibold text-neutral-300">Connected exchange</span>
            <div className="flex items-center justify-between rounded border border-[#F0B90B]/25 bg-[#F0B90B]/[0.07] px-1.5 py-1">
              <span className="flex items-center gap-1">
                <BinanceMark size={9} />
                <span className="text-[5.5px] font-semibold text-neutral-200">Binance</span>
              </span>
              <span className="text-[5px] font-semibold text-emerald-400">LIVE</span>
            </div>
            <div className="flex items-center justify-between rounded border border-white/[0.07] px-1.5 py-1">
              <span className="flex items-center gap-1">
                <BingXMark size={9} />
                <span className="text-[5.5px] font-semibold text-neutral-400">BingX</span>
              </span>
              <span className="text-[5px] text-neutral-600">Ready</span>
            </div>
            <div className="mt-auto rounded border border-white/[0.06] bg-black/40 p-1.5">
              <div className="text-[4.5px] font-semibold tracking-wide text-neutral-600">LAST SIGNAL</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-[7px] font-bold text-emerald-400">BUY</span>
                <span className="text-[5px] text-neutral-500">conf 87%</span>
              </div>
            </div>
          </div>
        </div>

        {/* positions */}
        <div className="rounded border border-white/[0.07] bg-white/[0.025] p-1.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[5.5px] font-semibold text-neutral-300">Open positions</span>
            <span className="text-[5px] text-neutral-600">5 active</span>
          </div>
          <div className="flex flex-col gap-[3px]">
            {positions.map(([sym, side, px, pnl, up]) => (
              <div key={sym} className="flex items-center justify-between rounded bg-white/[0.02] px-1.5 py-[3px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-[34px] text-[5.5px] font-semibold text-neutral-200">{sym}</span>
                  <span className="rounded bg-emerald-500/15 px-1 py-px text-[4.5px] font-bold text-emerald-400">{side}</span>
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="text-[5.5px] text-neutral-500">${px}</span>
                  <span className={`w-[26px] text-right text-[5.5px] font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>{pnl}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── globe: trading-hub arcs ──────────────────────── */
const ARC_COLORS = ['#10b981', '#22d3ee', '#34d399'];

// Deterministic (index-based, not Math.random) so re-renders stay stable.
const HUB_ARCS = [
  [1.3521, 103.8198, 35.6762, 139.6503, 0.2],   // Singapore → Tokyo
  [35.6762, 139.6503, 37.5665, 126.978, 0.1],   // Tokyo → Seoul
  [22.3193, 114.1694, 1.3521, 103.8198, 0.2],   // Hong Kong → Singapore
  [31.2304, 121.4737, 22.3193, 114.1694, 0.15], // Shanghai → Hong Kong
  [1.3521, 103.8198, 25.2048, 55.2708, 0.3],    // Singapore → Dubai
  [25.2048, 55.2708, 19.076, 72.8777, 0.15],    // Dubai → Mumbai
  [25.2048, 55.2708, 51.5072, -0.1276, 0.3],    // Dubai → London
  [51.5072, -0.1276, 52.52, 13.405, 0.1],       // London → Berlin
  [51.5072, -0.1276, 47.3769, 8.5417, 0.12],    // London → Zurich
  [51.5072, -0.1276, 40.7128, -74.006, 0.3],    // London → New York
  [40.7128, -74.006, 41.8781, -87.6298, 0.1],   // New York → Chicago
  [40.7128, -74.006, 37.7749, -122.4194, 0.25], // New York → San Francisco
  [37.7749, -122.4194, 1.3521, 103.8198, 0.5],  // SF → Singapore
  [-33.8688, 151.2093, 1.3521, 103.8198, 0.25], // Sydney → Singapore
  [-33.8688, 151.2093, 35.6762, 139.6503, 0.2], // Sydney → Tokyo
  [-23.5505, -46.6333, 40.7128, -74.006, 0.3],  // São Paulo → New York
  [-23.5505, -46.6333, 38.7223, -9.1393, 0.4],  // São Paulo → Lisbon
  [6.5244, 3.3792, 51.5072, -0.1276, 0.35],     // Lagos → London
  [-33.9249, 18.4241, 51.5072, -0.1276, 0.4],   // Cape Town → London
  [-1.2921, 36.8219, 25.2048, 55.2708, 0.25],   // Nairobi → Dubai
  [19.076, 72.8777, 1.3521, 103.8198, 0.25],    // Mumbai → Singapore
  [43.6532, -79.3832, 51.5072, -0.1276, 0.3],   // Toronto → London
  [52.3676, 4.9041, 51.5072, -0.1276, 0.08],    // Amsterdam → London
  [-34.6037, -58.3816, -23.5505, -46.6333, 0.1],// Buenos Aires → São Paulo
].map(([startLat, startLng, endLat, endLng, arcAlt], i) => ({
  order: (i % 8) + 1,
  startLat, startLng, endLat, endLng, arcAlt,
  color: ARC_COLORS[i % ARC_COLORS.length],
}));

const GLOBE_CONFIG = {
  pointSize: 4,
  globeColor: '#07130f',
  showAtmosphere: true,
  atmosphereColor: '#34d399',
  atmosphereAltitude: 0.13,
  emissive: '#062c20',
  emissiveIntensity: 0.14,
  shininess: 0.9,
  polygonColor: 'rgba(52,211,153,0.55)',
  ambientLight: '#10b981',
  directionalLeftLight: '#ffffff',
  directionalTopLight: '#ffffff',
  pointLight: '#34d399',
  arcTime: 1400,
  arcLength: 0.9,
  rings: 1,
  maxRings: 3,
  initialPosition: { lat: 22.3193, lng: 114.1694 },
  autoRotate: true,
  autoRotateSpeed: 0.5,
};

/* ───────────────── motion-reactive grid (camera is strictly opt-in) ─────── */
// WebcamPixelGrid requests the camera the moment it mounts, so it is only
// mounted after an explicit click — nothing is requested on page load.
function MotionGrid() {
  const [on, setOn] = useState(false);
  const [mono, setMono] = useState(true);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-[#030303]">
      {on ? (
        <>
          <WebcamPixelGrid
            gridCols={60}
            gridRows={40}
            maxElevation={50}
            motionSensitivity={0.25}
            elevationSmoothing={0.2}
            colorMode={mono ? 'monochrome' : 'webcam'}
            monochromeColor="#10b981"
            backgroundColor="#030303"
            mirror
            gapRatio={0.05}
            invertColors={false}
            darken={mono ? 0 : 0.6}
            borderColor="#ffffff"
            borderOpacity={0.06}
            className="h-full w-full"
          />
          <div className="absolute bottom-3 left-3 z-10 flex gap-2">
            <button onClick={() => setMono(v => !v)}
              className="rounded-full border border-white/15 bg-black/70 px-3 py-1.5 font-mono text-[11px] font-medium text-neutral-300 backdrop-blur transition hover:border-emerald-500/50 hover:text-white">
              {mono ? 'monochrome' : 'full colour'}
            </button>
            <button onClick={() => setOn(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 font-mono text-[11px] font-medium text-neutral-400 backdrop-blur transition hover:border-red-500/50 hover:text-red-300">
              <X size={11} /> stop camera
            </button>
          </div>
        </>
      ) : (
        <div className="absolute inset-0">
          {/* resting state — static grid, no camera */}
          <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(16,185,129,0.09)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.09)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_30%,transparent_100%)]" />
          <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="mb-5 grid size-12 place-items-center rounded-full border border-emerald-500/25 bg-emerald-500/10">
              <Camera size={20} className="text-emerald-400" />
            </span>
            <h3 className="mb-2 text-lg font-semibold tracking-tight text-neutral-100">
              Motion-reactive pixel grid
            </h3>
            <p className="mb-6 max-w-sm text-[13.5px] leading-relaxed text-neutral-500">
              Turn on your camera and the grid lifts into 3D wherever it detects movement.
              Frames are processed on a canvas in your browser — nothing is recorded, stored or uploaded.
            </p>
            <button onClick={() => setOn(true)}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-black transition hover:-translate-y-0.5">
              <span className="relative z-10 inline-flex items-center gap-2">
                <Camera size={15} /> Enable camera
              </span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </button>
            <p className="mt-4 font-mono text-[11px] text-neutral-700">optional · nothing leaves your device</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ page ════════ */
export default function Home() {
  const { data: session } = useSession();

  // The FloatingNav takes over past 5% scroll, so retire the static header
  // there instead of leaving two fixed bars stacked on top of each other.
  const { scrollYProgress } = useScroll();
  const [atTop, setAtTop] = useState(true);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setAtTop(v < 0.05);
  });

  const floatingNavItems = [
    { name: 'Features',      link: '#features', icon: <Bot size={16} /> },
    { name: 'Live analysis', link: '#analysis', icon: <BarChart3 size={16} /> },
    { name: 'Security',      link: '#security', icon: <Shield size={16} /> },
    { name: 'How it works',  link: '#how',      icon: <Activity size={16} /> },
  ];

  const timelineData = [
    {
      title: 'Step 01',
      content: (
        <div>
          <h4 className="mb-3 text-xl font-semibold tracking-tight text-neutral-100">Create your account</h4>
          <p className="mb-6 text-sm leading-relaxed text-neutral-400">
            Email and password. No KYC, no document upload, no waiting room. You are inside the dashboard in under a minute.
          </p>
          <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-5 font-mono text-[12px] text-neutral-500">
            <div className="text-emerald-400">$ signup --email you@example.com</div>
            <div className="mt-2">✓ account created</div>
            <div>✓ referral code generated — TRX8F2K</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Step 02',
      content: (
        <div>
          <h4 className="mb-3 text-xl font-semibold tracking-tight text-neutral-100">Connect Binance</h4>
          <p className="mb-6 text-sm leading-relaxed text-neutral-400">
            Generate a trade-only API key in Binance and paste it in. Withdrawal permission is never requested — the bot
            physically cannot move funds off your account.
          </p>
          <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-5 font-mono text-[12px]">
            <div className="flex justify-between text-neutral-500"><span>Enable Reading</span><span className="text-emerald-400">required</span></div>
            <div className="mt-1.5 flex justify-between text-neutral-500"><span>Enable Spot &amp; Margin Trading</span><span className="text-emerald-400">required</span></div>
            <div className="mt-1.5 flex justify-between text-neutral-500"><span>Enable Withdrawals</span><span className="text-red-400">never</span></div>
          </div>
        </div>
      ),
    },
    {
      title: 'Step 03',
      content: (
        <div>
          <h4 className="mb-3 text-xl font-semibold tracking-tight text-neutral-100">Activate the bot</h4>
          <p className="mb-6 text-sm leading-relaxed text-neutral-400">
            Choose your symbols, set how much capital it may use, pick a risk mode. One click and the five-minute
            scheduler picks you up on its next sweep.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[['Symbols', 'BTC · ETH · SOL'], ['Capital', '$2,000'], ['Mode', 'Aggressive'], ['Trailing SL', 'On · 2%']].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-white/10 bg-neutral-900/60 px-4 py-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-600">{k}</div>
                <div className="mt-1 font-mono text-[13px] text-neutral-200">{v}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Step 04',
      content: (
        <div>
          <h4 className="mb-3 text-xl font-semibold tracking-tight text-neutral-100">Earn and refer</h4>
          <p className="mb-6 text-sm leading-relaxed text-neutral-400">
            Watch the log fill in as it trades. Then share your referral code — you earn commission on every trade your
            referrals make, stacked on top of your own returns.
          </p>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-neutral-500">Referral earnings · last 30d</span>
              <span className="font-mono text-2xl font-bold text-emerald-400">+$412.80</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-black text-neutral-100 antialiased">

      {/* ══ FLOATING NAV — reveals on scroll-up ══ */}
      <FloatingNav
        navItems={floatingNavItems}
        cta={
          session ? (
            <Link href="/dashboard"
              className="shrink-0 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-[13px] font-semibold text-black transition hover:opacity-90">
              Dashboard
            </Link>
          ) : (
            <Link href="/register"
              className="shrink-0 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-[13px] font-semibold text-black transition hover:opacity-90">
              Get started
            </Link>
          )
        }
      />

      {/* ══ STATIC NAVBAR — shown at the top, hands off to FloatingNav ══ */}
      <nav className="fixed inset-x-0 top-3.5 z-[60] px-3 sm:px-4">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: atTop ? 1 : 0, y: atTop ? 0 : -24 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            boxShadow: '0 10px 40px -12px rgba(0,0,0,0.9)',
            pointerEvents: atTop ? 'auto' : 'none',
          }}
          className="mx-auto flex max-w-5xl items-center justify-between rounded-full border border-white/10 bg-black/70 py-2 pl-4 pr-2 backdrop-blur-xl sm:pl-5 sm:pr-2.5"
        >
          <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-[0_0_16px_rgba(16,185,129,0.5)]">
              <Zap size={14} className="text-black" strokeWidth={2.6} />
            </span>
            <span className="text-[14.5px] font-bold tracking-tight sm:text-[15.5px]">
              TrickyX<span className="text-emerald-400">.ai</span>
            </span>
          </Link>

          <div className="hidden items-center gap-6 text-[13.5px] lg:flex xl:gap-8">
            {[['#features', 'Features'], ['#analysis', 'Live analysis'], ['#security', 'Security'], ['#how', 'How it works']].map(([h, l]) => (
              <a key={h} href={h} className="whitespace-nowrap text-neutral-400 transition-colors hover:text-neutral-100">{l}</a>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {session ? (
              <Link href="/dashboard" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-3.5 py-2 text-[12.5px] font-semibold text-black transition hover:opacity-90 sm:px-4 sm:text-[13px]">
                Dashboard <ArrowRight size={13} className="hidden sm:block" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden whitespace-nowrap rounded-full border border-white/10 px-4 py-2 text-[13px] font-medium text-neutral-300 transition hover:border-emerald-500/40 hover:text-white sm:inline-block">
                  Sign in
                </Link>
                <Link href="/register" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-3.5 py-2 text-[12.5px] font-semibold text-black transition hover:opacity-90 sm:px-4 sm:text-[13px]">
                  Get started <ArrowRight size={13} className="hidden sm:block" />
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </nav>

      {/* ══ HERO — Spotlight ══ */}
      <section className="relative flex min-h-[92vh] w-full items-center overflow-hidden bg-black/[0.96] pt-28">
        <div className="pointer-events-none absolute inset-0 select-none [background-image:linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:54px_54px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_55%,transparent_100%)]" />
        <Spotlight />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-16">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.02fr] lg:gap-12 xl:gap-16">

            <div>
              <HoverBorderGradient
                as="div"
                containerClassName="rounded-full mb-8"
                className="flex items-center gap-2 bg-black px-4 py-1.5 text-[12.5px] text-neutral-300"
              >
                <Sparkles size={13} className="text-emerald-400" />
                <span>AI-powered crypto trading</span>
              </HoverBorderGradient>

              <h1 className="mb-6 text-[clamp(44px,6.2vw,76px)] font-extrabold leading-[0.98] tracking-[-0.04em]">
                <span className="bg-gradient-to-b from-white to-white/45 bg-clip-text text-transparent">
                  Trade smarter.
                </span>
                <br />
                <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                  Earn while you sleep.
                </span>
              </h1>

              <div className="mb-8 flex flex-wrap items-center gap-x-1 text-[clamp(17px,2vw,21px)] font-medium text-neutral-400">
                <span>It handles the</span>
                <FlipWords
                  words={['entries', 'trailing stops', 'risk gates', 'night shift', 'exits']}
                  className="font-semibold text-emerald-400"
                />
                <span>— you keep the keys.</span>
              </div>

              <p className="mb-9 max-w-[480px] text-[16.5px] leading-[1.7] text-neutral-500">
                Connect Binance, switch the bot on, and let it work the market around the clock. Every decision it makes
                is logged in plain language, so you always know why it did what it did.
              </p>

              <div className="mb-8 flex flex-wrap gap-3">
                <Link href="/register"
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-7 py-3.5 text-[15px] font-semibold text-black transition hover:-translate-y-0.5"
                  style={{ boxShadow: '0 10px 34px -8px rgba(16,185,129,0.6)' }}>
                  <span className="relative z-10 inline-flex items-center gap-2">
                    Start trading free <ArrowRight size={16} />
                  </span>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                </Link>
                <a href="#how"
                  className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-[15px] font-semibold text-neutral-200 backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-500/40">
                  See how it works
                </a>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                {['No credit card', 'Funds stay in your account', 'Cancel anytime'].map(p => (
                  <span key={p} className="inline-flex items-center gap-1.5 text-[13px] text-neutral-600">
                    <Check size={13} className="text-emerald-500" strokeWidth={3} /> {p}
                  </span>
                ))}
              </div>
            </div>

            {/* mobile / tablet: the laptop is too wide, so show the signal card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 22 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="flex justify-center lg:hidden"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="w-full max-w-[320px]"
              >
                <SignalCard />
              </motion.div>
            </motion.div>

            {/* desktop: laptop + floating signal card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 28 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="relative hidden justify-center lg:flex"
            >
              <motion.div
                animate={{ y: [0, -9, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                className="relative"
              >
                <MacbookHero screen={<DashboardScreen />} scale={0.74} />
              </motion.div>

              {/* signal card floating over the lower-left corner */}
              <motion.div
                initial={{ opacity: 0, x: -24, y: 16 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 0.75, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="absolute -left-6 bottom-6 z-20 hidden xl:block"
              >
                <motion.div
                  animate={{ y: [0, -13, 0] }}
                  transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                >
                  <div className="scale-[0.82] origin-bottom-left">
                    <SignalCard />
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══ PRICE MARQUEE ══ */}
      <section className="relative border-y border-white/[0.07] bg-white/[0.012]">
        <InfiniteMovingCards
          items={prices}
          speed="normal"
          className="max-w-none"
          itemClassName="px-1"
          renderItem={(t) => (
            <div className="flex items-center gap-2.5 whitespace-nowrap rounded-xl border border-white/[0.07] bg-white/[0.025] px-5 py-2.5 font-mono text-[13px]">
              <span className="font-bold tracking-wide text-neutral-300">{t.s}</span>
              <span className="text-neutral-500">${t.p}</span>
              <span className={t.up ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'}>
                {t.up ? '▲' : '▼'}{t.c}%
              </span>
            </div>
          )}
        />
      </section>

      {/* ══ STATS — WorldMap background ══ */}
      <section className="relative overflow-hidden px-6 py-24">
        {/* world map, routed between trading hubs.
            Edges fade via a mask so the page black shows through, rather than
            stacking a black overlay on top of the dots. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-full max-w-6xl [mask-image:radial-gradient(ellipse_80%_75%_at_50%_50%,#000_40%,transparent_85%)] [-webkit-mask-image:radial-gradient(ellipse_80%_75%_at_50%_50%,#000_40%,transparent_85%)]">
            <WorldMap
              lineColor="#10b981"
              dotColor="#FFFFFF80"
              mapBackgroundColor="transparent"
              height={54}
              lazy
              dots={[
                { start: { lat: 51.5074, lng: -0.1278 },  end: { lat: 40.7128, lng: -74.006 } },   // London → New York
                { start: { lat: 1.3521,  lng: 103.8198 }, end: { lat: 35.6762, lng: 139.6503 } },  // Singapore → Tokyo
                { start: { lat: 25.2048, lng: 55.2708 },  end: { lat: 19.076,  lng: 72.8777 } },   // Dubai → Mumbai
                { start: { lat: 51.5074, lng: -0.1278 },  end: { lat: 25.2048, lng: 55.2708 } },   // London → Dubai
                { start: { lat: -23.5505, lng: -46.6333 }, end: { lat: 38.7223, lng: -9.1393 } },  // São Paulo → Lisbon
                { start: { lat: 6.5244,  lng: 3.3792 },   end: { lat: 51.5074, lng: -0.1278 } },   // Lagos → London
                { start: { lat: -33.8688, lng: 151.2093 }, end: { lat: 1.3521, lng: 103.8198 } },  // Sydney → Singapore
              ]}
            />
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-48 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[90px]" />

        <div className="relative mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <p className="text-[11.5px] font-bold tracking-[0.16em] text-emerald-400">
              RUNNING IN 40+ COUNTRIES
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/[0.07] lg:grid-cols-4">
            {[['2,400+', 'Active traders'], ['1.2M+', 'Trades executed'], ['12–18%', 'Avg monthly ROI'], ['99.9%', 'Uptime']].map(([v, l], i) => (
              <motion.div key={l}
                initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6 }}
                className="bg-[#06060b]/80 px-5 py-9 text-center backdrop-blur-md"
              >
                <div className="mb-2.5 bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-400 bg-clip-text font-mono text-[clamp(28px,3.4vw,40px)] font-extrabold tracking-tight text-transparent">
                  {v}
                </div>
                <div className="text-[12.5px] font-medium tracking-wide text-neutral-600">{l}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ BENTO FEATURES — GlowingEffect ══ */}
      <section id="features" className="px-6 pb-24 pt-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 max-w-2xl">
            <span className="mb-5 inline-flex items-center gap-2.5 text-[11.5px] font-bold tracking-[0.16em] text-emerald-400">
              <span className="h-px w-6 bg-emerald-400" /> CAPABILITIES
            </span>
            <h2 className="mb-4 bg-gradient-to-b from-white to-white/45 bg-clip-text text-[clamp(33px,4.6vw,54px)] font-extrabold leading-[1.04] tracking-[-0.03em] text-transparent">
              Everything the bot needs.<br />Nothing you don&apos;t.
            </h2>
            <p className="text-[16.5px] leading-relaxed text-neutral-500">
              Built by traders who got tired of dashboards that look impressive and explain nothing.
            </p>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <BentoCard className="lg:col-span-2" icon={Bot} tag="AUTONOMOUS"
              title="An AI bot that trades while you sleep"
              desc="RSI, MACD, EMA crossovers and 24h momentum evaluated every five minutes across every symbol you enable. It enters on confirmation, scales into dips, and trails its own stop upward as price runs."
              visual={<ChartVisual />} />
            <BentoCard icon={Cpu} tag="ALWAYS ON"
              title="Five-minute heartbeat"
              desc="A scheduler sweeps every active account on a fixed cycle. No missed candles, nothing to babysit."
              visual={<OrbitVisual />} />
            <BentoCard icon={BarChart3} tag="TRANSPARENT"
              title="Every decision, logged in plain language"
              desc="Live P&L, open positions, trailing-stop state and the exact reasoning behind each entry and exit — streamed into your dashboard as it happens."
              visual={<SparkVisual />} className="lg:col-span-2" />
            <BentoCard icon={Activity} tag="GUARDED"
              title="Risk controls that actually fire"
              desc="Per-trade stop loss and take profit, trailing stops, a DCA guard, and a macro bear gate that blocks new entries in a downtrend." />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { icon: Users, t: 'Referral commission', d: 'Earn on every trade your referrals make. Unlimited depth, credited automatically.' },
              { icon: Globe, t: 'Binance native', d: 'Spot and Futures over the direct API. Real-time book data, sub-second fills.' },
              { icon: Shield, t: 'Non-custodial by design', d: 'Trade permission only. Withdrawal access is never requested, so funds cannot leave.' },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.t} className="relative rounded-2xl border border-white/10 p-[1px]">
                  <GlowingEffect spread={34} glow proximity={56} inactiveZone={0.01} borderWidth={2} disabled={false} />
                  <div className="relative h-full rounded-2xl bg-neutral-950 px-6 py-6">
                    <Icon size={19} className="mb-4 text-emerald-400" />
                    <h3 className="mb-2 text-[15.5px] font-semibold tracking-tight text-neutral-100">{s.t}</h3>
                    <p className="text-[13.5px] leading-relaxed text-neutral-400">{s.d}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ LIVE ANALYSIS — ImageGenerationLoader ══ */}
      <section id="analysis" className="relative border-t border-white/[0.07] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 max-w-2xl">
            <span className="mb-5 inline-flex items-center gap-2.5 text-[11.5px] font-bold tracking-[0.16em] text-emerald-400">
              <span className="h-px w-6 bg-emerald-400" /> LIVE ANALYSIS
            </span>
            <h2 className="mb-4 bg-gradient-to-b from-white to-white/45 bg-clip-text text-[clamp(31px,4.2vw,50px)] font-extrabold leading-[1.04] tracking-[-0.03em] text-transparent">
              Every five minutes,<br />it re-reads the market.
            </h2>
            <p className="text-[16.5px] leading-relaxed text-neutral-500">
              The scheduler pulls 100 fresh candles per symbol, recomputes every indicator, and decides again from
              scratch. No stale signals carried over from the last cycle.
            </p>
          </div>

          <div className="grid items-start gap-10 lg:grid-cols-[1.18fr_0.82fr] lg:gap-12">
            {/* chart being scanned */}
            <div>
              <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-neutral-950 outline-1 -outline-offset-1 outline-white/10">
                <div className="absolute left-4 top-3.5 z-20 flex items-center gap-2.5">
                  <span className="font-mono text-[11px] font-semibold tracking-wide text-neutral-300">BTCUSDT</span>
                  <span className="rounded border border-white/10 bg-white/5 px-1.5 py-px font-mono text-[9.5px] text-neutral-500">5m</span>
                  <span className="rounded border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-px font-mono text-[9.5px] text-cyan-300">EMA20</span>
                </div>

                <CandlestickChart />

                <ImageGenerationLoader
                  effect="scale-wave"
                  easing="ease-in-out"
                  text="Analysing"
                  cellSize={3}
                  gap={1}
                  bandHeight={48}
                  colors={['#34d399', '#065f46']}
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500">
                  <Cpu size={16} className="text-black" />
                </span>
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <p className="shrink-0 text-sm font-medium text-neutral-200">TrickyX engine</p>
                  <p className="truncate font-mono text-[12.5px] text-neutral-500">
                    scanning 100 bars · tick 14:35:00 UTC
                  </p>
                </div>
              </div>
            </div>

            {/* readout */}
            <div className="relative rounded-2xl border border-white/10 p-[1px]">
              <GlowingEffect spread={36} glow proximity={58} inactiveZone={0.01} borderWidth={2} disabled={false} />
              <div className="relative rounded-2xl bg-neutral-950 p-6">
                <div className="mb-5 flex items-center justify-between border-b border-white/[0.07] pb-4">
                  <span className="text-[10.5px] font-bold tracking-[0.13em] text-neutral-600">TICK READOUT</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    <span className="font-mono text-[10.5px] text-emerald-400">live</span>
                  </span>
                </div>

                <dl className="space-y-3.5">
                  {[
                    ['RSI (14)', '42.3', 'text-neutral-200'],
                    ['MACD', 'bullish cross', 'text-emerald-400'],
                    ['EMA20 / EMA50', 'above', 'text-emerald-400'],
                    ['Price vs EMA100', 'above — macro bull', 'text-emerald-400'],
                    ['Volume', '1.8× 20-bar avg', 'text-neutral-200'],
                    ['24h change', '+2.31%', 'text-emerald-400'],
                    ['Sentiment', 'bullish · 87%', 'text-emerald-400'],
                  ].map(([k, v, cls]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4">
                      <dt className="text-[12.5px] text-neutral-500">{k}</dt>
                      <dd className={`font-mono text-[12.5px] font-medium ${cls}`}>{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
                  <div className="mb-1.5 text-[10.5px] font-bold tracking-[0.13em] text-emerald-400/70">VERDICT</div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-extrabold tracking-tight text-emerald-400">BUY</span>
                    <span className="font-mono text-[11.5px] text-neutral-500">all gates passed</span>
                  </div>
                </div>

                <p className="mt-4 font-mono text-[11px] leading-relaxed text-neutral-600">
                  &gt; rsi below entry threshold, trend confirmed,<br />
                  &gt; no macro bear gate — placing order
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ EXCHANGE LOGOS ══ */}
      <section className="relative border-t border-white/[0.07] px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-9 text-[11.5px] font-bold tracking-[0.16em] text-neutral-600">
            CONNECTS DIRECTLY TO
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-6 py-4 transition hover:border-[#F0B90B]/35">
              <BinanceLogo />
              <span className="ml-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                spot · futures
              </span>
            </div>
            <div className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-6 py-4 transition hover:border-[#2354E6]/45">
              <BingXLogo />
              <span className="ml-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                spot · futures
              </span>
            </div>
          </div>
          <p className="mx-auto mt-8 max-w-md text-[13.5px] leading-relaxed text-neutral-600">
            Bring your own account on either exchange. Trade-only API keys, your funds never move off-platform.
          </p>
        </div>
      </section>

      {/* ══ GLOBE — 24/7 session coverage ══ */}
      <section id="sessions" className="relative overflow-hidden border-t border-white/[0.07] px-6 pt-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-6">
            <div className="relative z-20">
              <span className="mb-5 inline-flex items-center gap-2.5 text-[11.5px] font-bold tracking-[0.16em] text-emerald-400">
                <span className="h-px w-6 bg-emerald-400" /> ALWAYS ON
              </span>
              <h2 className="mb-5 bg-gradient-to-b from-white to-white/45 bg-clip-text text-[clamp(30px,4.2vw,50px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-transparent">
                The market never closes.<br />Neither does the bot.
              </h2>
              <p className="mb-8 max-w-[430px] text-[15.5px] leading-[1.72] text-neutral-500">
                Crypto runs through every session — Asia opens while Europe sleeps, New York takes over
                as Asia closes. The scheduler does not care what time it is where you are.
              </p>

              <div className="grid max-w-[420px] grid-cols-3 gap-3">
                {[
                  ['ASIA', 'Tokyo · Singapore', '00:00 UTC'],
                  ['EUROPE', 'London · Zurich', '08:00 UTC'],
                  ['US', 'New York · Chicago', '14:00 UTC'],
                ].map(([region, cities, open]) => (
                  <div key={region} className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-3">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                      <span className="text-[10px] font-bold tracking-[0.1em] text-emerald-400">{region}</span>
                    </div>
                    <div className="mb-1 text-[11.5px] leading-snug text-neutral-400">{cities}</div>
                    <div className="font-mono text-[10.5px] text-neutral-600">{open}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* globe */}
            <div className="relative h-[320px] w-full sm:h-[400px] lg:h-[520px]">
              <div className="absolute inset-0 z-10">
                <World data={HUB_ARCS} globeConfig={GLOBE_CONFIG} />
              </div>
              {/* fade the globe into the page at the base */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-b from-transparent to-black" />
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECURITY — EvervaultCard ══ */}
      <section id="security" className="relative border-t border-white/[0.07] px-6 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <span className="mb-5 inline-flex items-center gap-2.5 text-[11.5px] font-bold tracking-[0.16em] text-emerald-400">
              <span className="h-px w-6 bg-emerald-400" /> SECURITY
            </span>
            <h2 className="mb-5 bg-gradient-to-b from-white to-white/45 bg-clip-text text-[clamp(31px,4.2vw,48px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-transparent">
              Your keys never leave<br />encrypted storage.
            </h2>
            <p className="mb-8 max-w-[460px] text-[16px] leading-[1.72] text-neutral-500">
              API credentials are encrypted with AES-256 before they touch the database, and decrypted only in memory at
              the moment an order is placed. We request trade permission and nothing else — withdrawal access is not
              part of the key, so moving your funds is not technically possible for us.
            </p>
            <ul className="space-y-3.5">
              {[
                'AES-256 encryption at rest, decrypted only in memory',
                'Trade-only API scope — withdrawals never requested',
                'Funds remain in your own Binance account at all times',
                'Revoke access instantly from Binance or your dashboard',
              ].map(l => (
                <li key={l} className="flex items-start gap-3 text-[14.5px] text-neutral-400">
                  <span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-emerald-500/15">
                    <Check size={11} className="text-emerald-400" strokeWidth={3.2} />
                  </span>
                  {l}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center">
            <div className="relative w-full max-w-[380px] rounded-3xl border border-white/[0.14] p-5">
              <Lock className="absolute -left-2.5 -top-2.5 h-5 w-5 text-emerald-400/50" strokeWidth={1.5} />
              <Lock className="absolute -bottom-2.5 -right-2.5 h-5 w-5 text-emerald-400/50" strokeWidth={1.5} />
              <EvervaultCard text="AES-256" />
              <p className="mt-4 text-center text-[12.5px] text-neutral-500">
                Hover to see what an attacker would get.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ LAMP — section header ══ */}
      <LampContainer className="min-h-[24rem]">
        <motion.h2
          initial={{ opacity: 0.5, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.8, ease: 'easeInOut' }}
          className="bg-gradient-to-br from-neutral-100 to-neutral-500 bg-clip-text py-4 text-center text-4xl font-extrabold tracking-[-0.03em] text-transparent md:text-6xl"
        >
          Live in under <br /> five minutes
        </motion.h2>
      </LampContainer>

      {/* ══ TIMELINE ══ */}
      <div id="how" className="-mt-20">
        <Timeline data={timelineData} />
      </div>

      {/* ══ TESTIMONIALS — InfiniteMovingCards ══ */}
      <section id="voices" className="relative border-t border-white/[0.07] px-6 py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="mb-5 inline-block text-[11.5px] font-bold tracking-[0.16em] text-emerald-400">TRADERS</span>
          <h2 className="bg-gradient-to-b from-white to-white/45 bg-clip-text text-[clamp(29px,4vw,46px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-transparent">
            What people actually say
          </h2>
        </div>
        <div className="mx-auto max-w-7xl">
          <InfiniteMovingCards items={testimonials} speed="slow" direction="right" />
        </div>
      </section>

      {/* ══ MOTION GRID — WebcamPixelGrid, opt-in ══ */}
      <section id="playground" className="relative border-t border-white/[0.07] px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <span className="mb-5 inline-block text-[11.5px] font-bold tracking-[0.16em] text-emerald-400">
              PLAYGROUND
            </span>
            <h2 className="mb-4 bg-gradient-to-b from-white to-white/45 bg-clip-text text-[clamp(29px,4vw,46px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-transparent">
              Same canvas engine,<br />pointed at you instead.
            </h2>
            <p className="mx-auto max-w-lg text-[15.5px] leading-relaxed text-neutral-500">
              The charts and scan effects above are drawn on the same real-time canvas pipeline. Here it is running
              on a camera feed, purely because we could.
            </p>
          </div>
          <MotionGrid />
        </div>
      </section>

      {/* ══ CTA — BackgroundBeamsWithCollision ══ */}
      <BackgroundBeamsWithCollision className="min-h-[34rem] border-t border-white/[0.07] py-24">
        <div className="relative z-20 mx-auto max-w-2xl px-6 text-center">
          <h2 className="mb-6 text-[clamp(34px,5.2vw,60px)] font-extrabold leading-[1.02] tracking-[-0.04em]">
            <span className="bg-gradient-to-b from-white to-white/45 bg-clip-text text-transparent">Let the bot take</span>
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                the night shift.
              </span>
            </span>
          </h2>
          <p className="mb-10 text-[17px] leading-relaxed text-neutral-400">
            Join 2,400+ traders running TrickyX.ai on their Binance accounts right now.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-9 py-4 text-[15.5px] font-semibold text-black transition hover:-translate-y-0.5"
              style={{ boxShadow: '0 12px 40px -8px rgba(16,185,129,0.6)' }}>
              <span className="relative z-10 inline-flex items-center gap-2">
                Create free account <ArrowRight size={16} />
              </span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </Link>
            <Link href="/login"
              className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-7 py-4 text-[15.5px] font-semibold text-neutral-200 backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-500/40">
              Sign in
            </Link>
          </div>
          <p className="mt-7 font-mono text-[11.5px] text-neutral-700">
            trade-only api keys · aes-256 encrypted · no withdrawal access
          </p>
        </div>
      </BackgroundBeamsWithCollision>

      {/* ══ FOOTER ══ */}
      <footer className="relative overflow-hidden border-t border-white/[0.07] bg-black">
        {/* lit grid */}
        <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:54px_54px] [mask-image:linear-gradient(to_top,#000_5%,rgba(0,0,0,0.5)_45%,transparent_95%)]" />

        {/* cells that light up on the grid */}
        {[[1, 0], [4, 1], [8, 0], [12, 2], [15, 1], [19, 0], [22, 2], [6, 3], [17, 3]].map(([c, r], i) => (
          <motion.span
            key={i}
            aria-hidden
            className="pointer-events-none absolute bg-emerald-400/[0.09]"
            style={{ left: c * 54 + 1, bottom: r * 54 + 1, width: 53, height: 53 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, delay: i * 0.55, ease: 'easeInOut' }}
          />
        ))}

        {/* glow pooling up from the base */}
        <div className="pointer-events-none absolute -bottom-44 left-1/2 h-80 w-[min(1000px,120%)] -translate-x-1/2 rounded-full bg-emerald-500/[0.11] blur-[110px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-8">
          <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            {/* brand */}
            <div>
              <div className="mb-4 flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-[0_0_16px_rgba(16,185,129,0.45)]">
                  <Zap size={14} className="text-black" strokeWidth={2.6} />
                </span>
                <span className="text-[15.5px] font-bold tracking-tight text-neutral-100">
                  TrickyX<span className="text-emerald-400">.ai</span>
                </span>
              </div>
              <p className="mb-6 max-w-xs text-[13.5px] leading-relaxed text-neutral-500">
                Automated crypto trading on your own exchange account. Trade-only keys, full audit trail,
                funds never leave your custody.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2">
                  <BinanceMark size={15} />
                  <span className="text-[12px] font-medium text-neutral-400">Binance</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2">
                  <BingXMark size={15} />
                  <span className="text-[12px] font-medium text-neutral-400">BingX</span>
                </span>
              </div>
            </div>

            {/* link columns */}
            {[
              ['Product', [['#features', 'Features'], ['#analysis', 'Live analysis'], ['#security', 'Security'], ['#how', 'How it works'], ['#playground', 'Playground']]],
              ['Account', [['/login', 'Sign in'], ['/register', 'Create account'], ['/dashboard', 'Dashboard'], ['/dashboard/subscribe', 'Subscribe']]],
              ['Legal', [['/privacy', 'Privacy policy'], ['/terms', 'Terms of service'], ['/dashboard/support', 'Support'], ['/delete-account', 'Delete account']]],
            ].map(([heading, links]) => (
              <div key={heading}>
                <h3 className="mb-4 text-[10.5px] font-bold tracking-[0.14em] text-neutral-600">
                  {heading.toUpperCase()}
                </h3>
                <ul className="flex flex-col gap-3">
                  {links.map(([href, label]) => (
                    <li key={href}>
                      <Link href={href}
                        className="text-[13.5px] text-neutral-500 transition-colors hover:text-emerald-400">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* bottom bar */}
          <div className="mt-14 flex flex-col gap-4 border-t border-white/[0.07] pt-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <p className="text-[12.5px] text-neutral-600">© 2026 TrickyX.ai</p>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                <span className="font-mono text-[11.5px] text-emerald-400/90">all systems operational</span>
              </span>
            </div>
            <p className="max-w-md text-[11.5px] leading-relaxed text-neutral-700 sm:text-right">
              Trading involves substantial risk. Past performance does not guarantee future results.
              Never trade capital you cannot afford to lose.
            </p>
          </div>
        </div>

        {/* watermark wordmark */}
        <div aria-hidden className="pointer-events-none relative select-none px-6">
          <div className="mx-auto max-w-7xl">
            <span className="block bg-gradient-to-b from-white/[0.055] to-transparent bg-clip-text text-center text-[clamp(56px,14vw,170px)] font-extrabold leading-[0.8] tracking-[-0.05em] text-transparent">
              TrickyX.ai
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
