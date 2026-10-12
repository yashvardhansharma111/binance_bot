'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'motion/react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Reveals on scroll-up, hides on scroll-down, and stays hidden near the very
 * top (where a static header is expected to be showing instead).
 */
export const FloatingNav = ({ navItems, className, cta }) => {
  const { scrollYProgress } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollYProgress, 'change', (current) => {
    if (typeof current !== 'number') return;

    const prev = scrollYProgress.getPrevious();
    // getPrevious() is undefined on the first event — NaN would flip it on.
    const direction = typeof prev === 'number' ? current - prev : 0;

    if (current < 0.05) {
      setVisible(false);
    } else {
      setVisible(direction < 0);
    }
  });

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 1, y: -100 }}
        animate={{ y: visible ? 0 : -100, opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'fixed inset-x-0 top-4 z-[5000] mx-auto flex max-w-fit items-center justify-center px-3 sm:top-6',
          className
        )}
        style={{ pointerEvents: visible ? 'auto' : 'none' }}
      >
        <div className="flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/70 px-2 py-1.5 shadow-lg shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-0.5">
            {navItems.map((navItem, idx) => (
              <Link
                key={`fnav-${idx}`}
                href={navItem.link}
                title={navItem.name}
                aria-label={navItem.name}
                className="relative flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white sm:px-4"
              >
                {navItem.icon && <span className="block sm:hidden">{navItem.icon}</span>}
                <span className="hidden whitespace-nowrap sm:block">{navItem.name}</span>
              </Link>
            ))}
          </div>

          <div className="h-5 w-px shrink-0 bg-white/10" />

          {cta ?? (
            <Link
              href="/login"
              className="relative shrink-0 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black transition-all hover:bg-neutral-100 hover:shadow-lg hover:shadow-white/20"
            >
              Login
            </Link>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
