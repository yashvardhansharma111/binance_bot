'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'motion/react';
import {
  Wallet, RefreshCw, AlertCircle, Check, Copy, Link2Off, ExternalLink, Info,
} from 'lucide-react';
import { useWallet } from '@/lib/useWallet';

const CHAINS = [
  { id: 11155111, label: 'Sepolia', testnet: true },
  { id: 1,        label: 'Ethereum' },
  { id: 56,       label: 'BNB Chain' },
  { id: 137,      label: 'Polygon' },
];

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
const fmt = (v) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  return n < 0.0001 ? n.toExponential(2) : n.toLocaleString(undefined, { maximumFractionDigits: 6 });
};

export default function WalletCard() {
  const { data: session, update } = useSession();
  const { connect, signSiwe, hasProvider, connecting, ready } = useWallet();

  const linked = session?.user?.walletAddress || null;

  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(false);
  const [chainId, setChainId] = useState(Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID) || 1);
  const [bal, setBal]         = useState(null);
  const [balLoading, setBalLoading] = useState(false);

  const loadBalance = useCallback(async (cid) => {
    if (!linked) return;
    setBalLoading(true);
    try {
      const r = await fetch(`/api/wallet/balance?chainId=${cid}`);
      const d = await r.json();
      setBal(r.ok ? d : null);
      if (!r.ok) setError(d.error || 'Could not read balances');
    } catch {
      setBal(null);
    } finally {
      setBalLoading(false);
    }
  }, [linked]);

  useEffect(() => { if (linked) loadBalance(chainId); }, [linked, chainId, loadBalance]);

  async function handleConnect() {
    setError('');
    if (!hasProvider) {
      const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
      window.location.href = isMobile
        ? `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`
        : 'https://metamask.com/download/';
      return;
    }
    setBusy(true);
    try {
      const addr = await connect();
      const { message, signature } = await signSiwe(addr);
      const r = await fetch('/api/wallet/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Could not link wallet'); return; }
      await update();           // refresh session so walletAddress appears
    } catch (err) {
      setError(err?.code === 4001 ? 'Request cancelled in MetaMask' : err?.message || 'Connection failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setError('');
    setBusy(true);
    try {
      const r = await fetch('/api/wallet/link', { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Could not unlink'); return; }
      setBal(null);
      await update();
    } finally {
      setBusy(false);
    }
  }

  function copyAddr() {
    navigator.clipboard?.writeText(linked).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  }

  const working = busy || connecting;

  return (
    <div className="card glow-border" style={{ padding: '20px 22px' }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg"
            style={{ background: 'rgba(246,133,27,0.14)', border: '1px solid rgba(246,133,27,0.3)' }}>
            <Wallet size={16} style={{ color: '#F6851B' }} />
          </span>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>MetaMask Wallet</h2>
            <p className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              On-chain trading &amp; balances
            </p>
          </div>
        </div>
        {linked && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: 'var(--success)' }}>
            <span className="size-1.5 rounded-full" style={{ background: 'var(--success)' }} /> Connected
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px]"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5' }}>
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {!linked ? (
        <>
          <p className="mb-4 text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
            Connect a wallet to see on-chain balances and trade directly from it. Independent of your
            Binance / BingX API key — you can have both.
          </p>
          <motion.button onClick={handleConnect} disabled={working}
            whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13.5px] font-semibold transition disabled:opacity-60"
            style={{ background: 'rgba(246,133,27,0.14)', border: '1px solid rgba(246,133,27,0.4)', color: '#F6851B' }}>
            {working || !ready ? <RefreshCw size={15} className="animate-spin" /> : <Wallet size={15} />}
            {working ? 'Check MetaMask…' : !ready ? 'Detecting wallet…' : hasProvider ? 'Connect MetaMask' : 'Install MetaMask'}
          </motion.button>
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2.5"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <span className="flex-1 font-mono text-[12.5px]" style={{ color: 'var(--text-1)' }}>
              {short(linked)}
            </span>
            <button onClick={copyAddr} className="shrink-0 rounded p-1.5 transition-colors"
              style={{ color: copied ? 'var(--success)' : 'var(--text-3)' }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <a href={`https://etherscan.io/address/${linked}`} target="_blank" rel="noreferrer"
              className="shrink-0 rounded p-1.5" style={{ color: 'var(--text-3)' }}>
              <ExternalLink size={14} />
            </a>
          </div>

          {/* chain switcher */}
          <div className="mb-3 flex gap-1 rounded-lg p-1"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {CHAINS.map((c) => (
              <button key={c.id} onClick={() => setChainId(c.id)}
                className="flex-1 rounded-md px-2 py-1.5 text-[11.5px] font-semibold transition-all"
                style={{
                  background: chainId === c.id ? 'var(--accent-dim)' : 'transparent',
                  color: chainId === c.id ? 'var(--accent)' : 'var(--text-3)',
                }}>
                {c.label}
              </button>
            ))}
          </div>

          {/* balances */}
          <div className="mb-4 rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10.5px] font-bold tracking-wider" style={{ color: 'var(--text-3)' }}>
                BALANCES
              </span>
              <button onClick={() => loadBalance(chainId)} disabled={balLoading}
                className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
                <RefreshCw size={11} className={balLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
            {balLoading && !bal ? (
              <div className="py-3 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>Loading…</div>
            ) : bal ? (
              <div className="flex flex-col gap-1.5">
                {[{ symbol: bal.native.symbol, balance: bal.native.balance }, ...(bal.tokens || [])].map((t) => (
                  <div key={t.symbol} className="flex items-baseline justify-between">
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-2)' }}>{t.symbol}</span>
                    <span className="font-mono text-[12.5px]" style={{ color: 'var(--text-1)' }}>{fmt(t.balance)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-3 text-center text-[12px]" style={{ color: 'var(--text-3)' }}>No data</div>
            )}
          </div>

          <div className="mb-4 flex gap-2 rounded-lg px-3 py-2.5"
            style={{ background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.26)' }}>
            <Info size={14} className="mt-px shrink-0" style={{ color: '#fbbf24' }} />
            <p className="text-[11.5px] leading-relaxed" style={{ color: '#fcd34d' }}>
              The automated bot cannot trade this wallet — every on-chain swap has to be signed in
              MetaMask by you. Bot automation runs on Binance / BingX only.
            </p>
          </div>

          <button onClick={handleUnlink} disabled={working}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold transition-all disabled:opacity-60"
            style={{ color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <Link2Off size={14} /> Disconnect Wallet
          </button>
        </>
      )}
    </div>
  );
}
