'use client';
import Link from 'next/link';
import { Repeat, Info } from 'lucide-react';
import WalletSwap from '@/components/WalletSwap';

/** On-chain token swaps through the user's own MetaMask wallet — separate from Binance trading. */
export default function SwapPage() {
  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 lg:text-2xl">
          <Repeat size={20} className="text-orange-500" /> MetaMask Swap
        </h1>
        <p className="mt-0.5 text-xs text-slate-500 lg:text-sm">
          Swap tokens on-chain from your own MetaMask wallet. You sign every swap in MetaMask.
        </p>
      </div>

      <div className="mb-5 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
        <span>
          This is separate from the trading bot and your Binance trades. Swaps happen directly on the blockchain, network gas fees apply,
          and they do not appear in <Link href="/dashboard/trade" className="font-semibold text-blue-600">Active Trades</Link>.
          Link your wallet in <Link href="/dashboard/apikeys" className="font-semibold text-blue-600">API Keys</Link> if it is not connected yet.
        </span>
      </div>

      <WalletSwap />
    </div>
  );
}
