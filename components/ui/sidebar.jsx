'use client';
import { cn } from '@/lib/utils';
import React, { useState, createContext, useContext } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { IconMenu2, IconX } from '@tabler/icons-react';
import Link from 'next/link';

const SidebarContext = createContext(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used within a SidebarProvider');
  return context;
};

export const SidebarProvider = ({ children, open: openProp, setOpen: setOpenProp, animate = true }) => {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({ children, open, setOpen, animate }) => (
  <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
    {children}
  </SidebarProvider>
);

export const SidebarBody = (props) => (
  <>
    <DesktopSidebar {...props} />
    <MobileSidebar {...props} />
  </>
);

export const DesktopSidebar = ({ className, children, collapsedWidth = 70, expandedWidth = 252, ...props }) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn('h-full shrink-0 px-3 py-4 hidden md:flex md:flex-col', className)}
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      animate={{ width: animate ? (open ? expandedWidth : collapsedWidth) : expandedWidth }}
      transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.6 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({ className, children, ...props }) => {
  const { open, setOpen } = useSidebar();
  return (
    <div
      className="flex h-10 w-full flex-row items-center justify-between px-4 py-4 md:hidden"
      style={{ background: 'var(--surface)' }}
      {...props}
    >
      <div className="z-20 flex w-full justify-end">
        <IconMenu2 style={{ color: 'var(--text-2)' }} onClick={() => setOpen(!open)} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={cn('fixed inset-0 z-[100] flex h-full w-full flex-col justify-between p-10', className)}
            style={{ background: 'var(--bg)' }}
          >
            <div className="absolute right-10 top-10 z-50" style={{ color: 'var(--text-2)' }}
              onClick={() => setOpen(!open)}>
              <IconX />
            </div>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Renders a Next `Link` (the original uses a bare `<a>`, which would full-reload
 * every dashboard navigation) and supports an `active` highlight.
 */
export const SidebarLink = ({ link, className, onClick, ...props }) => {
  const { open, animate } = useSidebar();
  const active = link.active;

  return (
    <Link
      href={link.href}
      onClick={onClick}
      title={link.label}
      className={cn(
        'group/sidebar relative flex items-center justify-start gap-2.5 rounded-lg px-2.5 py-2.5 transition-colors',
        className
      )}
      style={{
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-2)',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      {...props}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="absolute inset-y-[18%] left-0 w-[2.5px] rounded-full"
          style={{ background: 'var(--accent)' }}
        />
      )}

      <span className="shrink-0">{link.icon}</span>

      <motion.span
        animate={{
          display: animate ? (open ? 'inline-block' : 'none') : 'inline-block',
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="m-0! inline-block whitespace-pre p-0! text-[13.5px] font-medium transition duration-150 group-hover/sidebar:translate-x-1"
      >
        {link.label}
      </motion.span>
    </Link>
  );
};
