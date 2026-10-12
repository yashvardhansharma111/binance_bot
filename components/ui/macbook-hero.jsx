'use client';
import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { Keypad, Trackpad, SpeakerGrid } from '@/components/ui/macbook-scroll';

/**
 * Hero-sized Macbook. The lid starts tilted and straightens as the hero
 * scrolls — tuned for a column, unlike MacbookScroll which needs 200vh.
 * Reuses MacbookScroll's Keypad / Trackpad / SpeakerGrid.
 */
export function MacbookHero({ screen, scale = 0.74, className }) {
  const ref = useRef(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 85%', 'end 15%'],
  });

  // Spring-smooth the raw scroll value so motion feels weighted, not twitchy.
  const p = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.4 });

  const rotateX    = useTransform(p, [0, 0.42], [-24, 0]);
  const scaleY     = useTransform(p, [0, 0.42], [0.86, 1]);
  const lidY       = useTransform(p, [0, 0.42], [10, 0]);
  const screenFade = useTransform(p, [0.06, 0.34], [0, 1]);
  const glow       = useTransform(p, [0.1, 0.5], [0.15, 0.6]);

  const LID_W = 512;
  const LID_H = 384;
  const BASE_H = 352;

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: LID_W * scale, height: (LID_H + BASE_H) * scale }}
    >
      <div
        style={{
          width: LID_W,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* glow pooled under the machine */}
        <motion.div
          aria-hidden
          style={{ opacity: glow }}
          className="pointer-events-none absolute left-1/2 top-[38%] -z-10 h-72 w-[30rem] -translate-x-1/2 rounded-full bg-emerald-500/25 blur-[80px]"
        />

        {/* ── Lid ── */}
        <div className="relative [perspective:900px]">
          {/* outer shell (closed-lid back, seen edge-on) */}
          <div
            style={{
              transform: 'perspective(900px) rotateX(-25deg) translateZ(0px)',
              transformOrigin: 'bottom',
              transformStyle: 'preserve-3d',
            }}
            className="relative h-[12rem] w-[32rem] rounded-2xl bg-[#010101] p-2"
          >
            <div
              style={{ boxShadow: '0px 2px 0px 2px #171717 inset' }}
              className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#010101]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-neutral-700" fill="currentColor">
                <path d="M13 2 4.5 13.5H10l-1 8.5 8.5-11.5H12l1-8.5Z" />
              </svg>
            </div>
          </div>

          {/* screen — rotates open on scroll */}
          <motion.div
            style={{
              rotateX,
              scaleY,
              translateY: lidY,
              transformStyle: 'preserve-3d',
              transformOrigin: 'top',
            }}
            className="absolute inset-0 h-96 w-[32rem] rounded-2xl bg-[#010101] p-2"
          >
            <div className="absolute inset-0 rounded-lg bg-[#272729]" />
            <div className="absolute inset-0 overflow-hidden rounded-lg bg-black">
              <motion.div style={{ opacity: screenFade }} className="h-full w-full">
                {screen}
              </motion.div>
              {/* screen sheen */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent" />
            </div>
            {/* camera notch dot */}
            <div className="absolute left-1/2 top-[7px] size-[3px] -translate-x-1/2 rounded-full bg-neutral-700" />
          </motion.div>
        </div>

        {/* ── Base ── */}
        <div className="relative -z-10 h-[22rem] w-[32rem] overflow-hidden rounded-2xl bg-[#272729]">
          <div className="relative h-10 w-full">
            <div className="absolute inset-x-0 mx-auto h-4 w-[80%] bg-[#050505]" />
          </div>
          <div className="relative flex">
            <div className="mx-auto h-full w-[10%] overflow-hidden"><SpeakerGrid /></div>
            <div className="mx-auto h-full w-[80%]"><Keypad /></div>
            <div className="mx-auto h-full w-[10%] overflow-hidden"><SpeakerGrid /></div>
          </div>
          <Trackpad />
          <div className="absolute inset-x-0 bottom-0 mx-auto h-2 w-20 rounded-tl-3xl rounded-tr-3xl bg-gradient-to-t from-[#272729] to-[#050505]" />
        </div>
      </div>
    </div>
  );
}
