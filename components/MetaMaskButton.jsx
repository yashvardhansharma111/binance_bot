'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useWallet } from '@/lib/useWallet';

function FoxIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 34" fill="none" aria-hidden="true">
      <path d="M33.3 1L20 10.9l2.5-5.8L33.3 1z" fill="#E2761B" stroke="#E2761B" strokeWidth=".3" strokeLinejoin="round" />
      <path d="M2.7 1l13.2 10L13.5 5.1 2.7 1zM28.5 24.3l-3.5 5.4 7.5 2.1 2.2-7.3-6.2-.2zM1.4 24.5l2.1 7.3 7.5-2.1-3.5-5.4-6.1.2z" fill="#E4761B" stroke="#E4761B" strokeWidth=".3" strokeLinejoin="round" />
      <path d="M10.6 14.8L8.5 18l7.4.3-.2-8-5.1 4.5zM25.4 14.8l-5.2-4.6-.2 8.1 7.4-.3-2-3.2zM11 29.7l4.5-2.2-3.9-3-.6 5.2zM20.5 27.5l4.5 2.2-.6-5.2-3.9 3z" fill="#E4761B" stroke="#E4761B" strokeWidth=".3" strokeLinejoin="round" />
      <path d="M25 29.7l-4.5-2.2.4 2.9v1.3l4.1-2zM11 29.7l4.1 2v-1.3l.3-2.9-4.4 2.2z" fill="#D7C1B3" stroke="#D7C1B3" strokeWidth=".3" strokeLinejoin="round" />
      <path d="M15.2 22.6l-3.7-1.1 2.6-1.2 1.1 2.3zM20.8 22.6l1.1-2.3 2.6 1.2-3.7 1.1z" fill="#233447" stroke="#233447" strokeWidth=".3" strokeLinejoin="round" />
      <path d="M11 29.7l.6-5.4-4.1.2L11 29.7zM24.4 24.3l.6 5.4 3.5-5.2-4.1-.2zM27.4 18l-7.4.3.7 3.8 1.1-2.3 2.6 1.2 3-3zM11.5 21.5l2.6-1.2 1.1 2.3.7-3.8-7.4-.3 3 3z" fill="#CD6116" stroke="#CD6116" strokeWidth=".3" strokeLinejoin="round" />
      <path d="M8.5 18l3.1 6-.1-3 -3-3zM24.5 21l-.1 3 3.1-6-3 3zM15.9 18.3l-.7 3.8.9 4.5.2-5.9-.4-2.4zM20 18.3l-.4 2.4.2 5.9.9-4.5-.7-3.8z" fill="#E4751F" stroke="#E4751F" strokeWidth=".3" strokeLinejoin="round" />
      <path d="M20.8 22.6l-.9 4.5.6.5 3.9-3 .1-3-3.7 1zM11.5 21.5l.1 3 3.9 3 .6-.5-.9-4.5-3.7-1z" fill="#F6851B" stroke="#F6851B" strokeWidth=".3" strokeLinejoin="round" />
      <path d="M20.9 31.6v-1.3l-.4-.3h-5l-.3.3v1.3l-4.2-2 1.5 1.2 3 2.1h5.1l3-2.1 1.5-1.2-4.2 2z" fill="#C0AD9E" stroke="#C0AD9E" strokeWidth=".3" strokeLinejoin="round" />
      <path d="M20.5 27.5l-.6-.5h-3.8l-.6.5-.3 2.9.3-.3h5l.4.3-.4-2.9z" fill="#161616" stroke="#161616" strokeWidth=".3" strokeLinejoin="round" />
      <path d="M33.9 11.5L35 5.8 33.3 1 20.5 10.5l4.9 4.3 7 2 1.5-1.8-.7-.5 1.1-1-.8-.6 1-.8-.6-.6zM1 5.8l1.1 5.7-.7.5 1 .8-.8.6 1.1 1-.7.5L3.5 16.8l7-2 4.9-4.3L2.7 1 1 5.8z" fill="#763D16" stroke="#763D16" strokeWidth=".3" strokeLinejoin="round" />
      <path d="M32.4 16.8l-7-2 2 3.2-3 6 4-.1h6.1l-2.1-7.1zM10.6 14.8l-7 2-2.1 7.1h6.1l4 .1-3-6 2-3.2zM20 18.3l.4-7.8 2-5.4H13.5l2 5.4.5 7.8.2 2.4v5.9h3.8v-5.9l.1-2.4z" fill="#F6851B" stroke="#F6851B" strokeWidth=".3" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * MetaMask sign-in. Connects the wallet, has it sign a SIWE nonce, then hands
 * message+signature to the `wallet` NextAuth provider for verification.
 */
export default function MetaMaskButton({ callbackUrl = '/dashboard', className = '' }) {
  const router = useRouter();
  const { connect, signSiwe, connecting, hasProvider, metaMaskFound, ready, providers } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    setError('');

    if (!hasProvider) {
      // Deep-link into the MetaMask mobile app browser; on desktop, the install page.
      const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
      if (isMobile) {
        const host = window.location.host + window.location.pathname;
        window.location.href = `https://metamask.app.link/dapp/${host}`;
      } else {
        window.open('https://metamask.com/download/', '_blank', 'noopener');
      }
      return;
    }

    setBusy(true);
    try {
      const addr = await connect();
      const { message, signature } = await signSiwe(addr);

      const res = await signIn('wallet', { message, signature, redirect: false });
      if (res?.error) {
        setError(res.error === 'CredentialsSignin' ? 'Could not verify signature' : res.error);
        return;
      }
      router.push(callbackUrl);
    } catch (err) {
      // 4001 is the EIP-1193 "user rejected request" code.
      if (err?.code === 4001) setError('Request cancelled in MetaMask');
      else setError(err?.message || 'Wallet connection failed');
    } finally {
      setBusy(false);
    }
  }

  const loading = busy || connecting;

  // Extensions announce themselves a beat after hydration — don't flash
  // "Install MetaMask" at someone who already has it.
  const label = loading
    ? 'Check MetaMask…'
    : !ready
      ? 'Detecting wallet…'
      : hasProvider
        ? 'Continue with MetaMask'
        : 'Install MetaMask';

  // Another wallet answered but MetaMask did not — say so, since clicking
  // would otherwise open a different wallet than the button promises.
  const otherWallet = ready && hasProvider && !metaMaskFound
    ? providers[0]?.info?.name || 'another wallet'
    : null;

  return (
    <div className={className}>
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={loading || !ready}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.985 }}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-[14px] font-semibold text-neutral-200 backdrop-blur transition hover:border-[#F6851B]/50 hover:bg-white/[0.07] disabled:opacity-60"
      >
        {loading || !ready
          ? <RefreshCw size={15} className="animate-spin" />
          : <FoxIcon size={18} />}
        {label}
      </motion.button>

      {otherWallet && (
        <p className="mt-2 text-center text-[11.5px] text-neutral-500">
          Detected <strong className="text-neutral-400">{otherWallet}</strong>. If you meant MetaMask,
          disable the other wallet as default in your browser settings.
        </p>
      )}

      {error && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-red-400">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}
