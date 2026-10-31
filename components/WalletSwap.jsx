'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'motion/react';
import {
  BrowserProvider, Contract, parseUnits, formatUnits, MaxUint256,
} from 'ethers';
import {
  ArrowDownUp, RefreshCw, AlertCircle, CheckCircle2, ExternalLink,
  Wallet, Settings2, Info, FlaskConical, RotateCcw, Zap,
} from 'lucide-react';
import { DEX, ERC20_ABI, ROUTER_ABI, isNative, resolveToken, NATIVE } from '@/lib/dex';
import { useWallet } from '@/lib/useWallet';

const SLIPPAGE_OPTS = [
  { bps: 10,  label: '0.1%' },
  { bps: 50,  label: '0.5%' },
  { bps: 100, label: '1%'   },
  { bps: 300, label: '3%'   },
];

const fmt = (v, max = 6) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  return n < 0.000001 ? n.toExponential(2) : n.toLocaleString(undefined, { maximumFractionDigits: max });
};

export default function WalletSwap() {
  const { data: session } = useSession();
  const { connect, hasProvider, getProvider } = useWallet();
  const linked = session?.user?.walletAddress || null;

  const [chainId, setChainId]   = useState(Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID) || 1);
  const [tokenIn, setTokenIn]   = useState('USDT');
  const [tokenOut, setTokenOut] = useState('WETH');
  const [amount, setAmount]     = useState('');
  const [slippage, setSlippage] = useState(50);
  const [showSettings, setShowSettings] = useState(false);

  const [quote, setQuote]     = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError]     = useState('');
  const [stage, setStage]     = useState('idle'); // idle|approving|swapping|done
  const [txHash, setTxHash]   = useState('');
  const [balIn, setBalIn]     = useState(null);
  const [paper, setPaper]     = useState(true);   // start in the playground
  const [paperAcct, setPaperAcct] = useState(null);
  const [paperMsg, setPaperMsg]   = useState('');

  const cfg = DEX[chainId];
  const symbols = Object.keys(cfg?.tokens ?? {});
  const debounceRef = useRef(null);

  // Keep the pair valid when switching chains.
  useEffect(() => {
    const list = Object.keys(DEX[chainId]?.tokens ?? {});
    if (!list.includes(tokenIn))  setTokenIn(list[1] ?? list[0]);
    if (!list.includes(tokenOut)) setTokenOut(list.find((s) => s !== tokenIn) ?? list[0]);
    setQuote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]);

  /* ── balance of the input token ─────────────────────────────────────── */
  const loadBalance = useCallback(async () => {
    const eth = getProvider();
    if (!linked || !eth) return;
    try {
      const tok = resolveToken(chainId, tokenIn);
      const provider = new BrowserProvider(eth);
      if (isNative(tok.address)) {
        const wei = await provider.getBalance(linked);
        setBalIn(formatUnits(wei, 18));
      } else {
        const c = new Contract(tok.address, ERC20_ABI, provider);
        const [raw, dec] = await Promise.all([c.balanceOf(linked), c.decimals()]);
        setBalIn(formatUnits(raw, dec));
      }
    } catch {
      setBalIn(null);
    }
  }, [linked, chainId, tokenIn, getProvider]);

  useEffect(() => { loadBalance(); }, [loadBalance]);

  const loadPaper = useCallback(async () => {
    try {
      const r = await fetch('/api/wallet/paper');
      if (r.ok) setPaperAcct(await r.json());
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { if (paper) loadPaper(); }, [paper, loadPaper]);

  /* ── debounced quote ────────────────────────────────────────────────── */
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!amount || Number(amount) <= 0 || tokenIn === tokenOut) { setQuote(null); return; }

    debounceRef.current = setTimeout(async () => {
      setQuoting(true);
      setError('');
      try {
        const r = await fetch('/api/wallet/swap/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chainId, tokenIn, tokenOut, amountIn: amount, slippageBps: slippage }),
        });
        const d = await r.json();
        if (!r.ok) { setError(d.error || 'Quote failed'); setQuote(null); return; }
        setQuote(d);
      } catch {
        setError('Quote failed');
        setQuote(null);
      } finally {
        setQuoting(false);
      }
    }, 450);

    return () => clearTimeout(debounceRef.current);
  }, [chainId, tokenIn, tokenOut, amount, slippage]);

  function flip() {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmount('');
    setQuote(null);
  }

  /* ── paper (simulated) execution ────────────────────────────────────── */
  async function handlePaperSwap() {
    setError('');
    setPaperMsg('');
    if (!quote) return;
    setStage('swapping');
    try {
      const r = await fetch('/api/wallet/paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainId, tokenIn, tokenOut, amountIn: amount }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Simulated swap failed'); setStage('idle'); return; }
      setPaperAcct((prev) => ({ ...(prev || {}), balances: d.balances, tradeCount: d.tradeCount }));
      setPaperMsg(`Filled ${fmt(amount)} ${tokenIn} → ${fmt(d.trade.amountOut)} ${tokenOut}`);
      setStage('done');
      setAmount('');
      setQuote(null);
      loadPaper();
    } catch {
      setError('Simulated swap failed');
      setStage('idle');
    }
  }

  async function resetPaper() {
    await fetch('/api/wallet/paper', { method: 'DELETE' });
    setPaperMsg('');
    setStage('idle');
    loadPaper();
  }

  /* ── execute: approve (if needed) then swap ─────────────────────────── */
  async function handleSwap() {
    setError('');
    setTxHash('');
    if (!quote) return;

    try {
      const eth = getProvider();
      if (!eth) throw new Error('No wallet detected');
      await connect();

      const provider = new BrowserProvider(eth);

      // The wallet must be on the chain we quoted against.
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== chainId) {
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + chainId.toString(16) }],
          });
        } catch {
          throw new Error(`Switch MetaMask to ${cfg.name} and try again`);
        }
      }

      const signer = await provider.getSigner();
      const owner = await signer.getAddress();
      const amtWei = BigInt(quote.amountInWei);
      const nativeIn = isNative(quote.tokenIn.address);

      // ERC-20 inputs need an allowance for the router before it can pull funds.
      if (!nativeIn) {
        const erc20 = new Contract(quote.tokenIn.address, ERC20_ABI, signer);
        const current = await erc20.allowance(owner, quote.router);
        if (current < amtWei) {
          setStage('approving');
          const txA = await erc20.approve(quote.router, MaxUint256);
          await txA.wait();
        }
      }

      setStage('swapping');
      const router = new Contract(quote.router, ROUTER_ABI, signer);
      const tx = await router.exactInputSingle(
        {
          tokenIn:  quote.tokenIn.pool,
          tokenOut: quote.tokenOut.pool,
          fee: quote.fee,
          recipient: owner,
          amountIn: amtWei,
          amountOutMinimum: BigInt(quote.minAmountOutWei),
          sqrtPriceLimitX96: 0,
        },
        nativeIn ? { value: amtWei } : {}
      );

      setTxHash(tx.hash);
      await tx.wait();
      setStage('done');
      setAmount('');
      setQuote(null);
      loadBalance();
    } catch (err) {
      if (err?.code === 4001 || err?.code === 'ACTION_REJECTED') setError('Cancelled in MetaMask');
      else setError(err?.shortMessage || err?.message || 'Swap failed');
      setStage('idle');
    }
  }

  const busy = stage === 'approving' || stage === 'swapping';
  const paperBal = Number(paperAcct?.balances?.[tokenIn] ?? 0);

  // The playground needs no wallet at all — only live mode does.
  if (!linked && !paper) {
    return (
      <div className="card glow-border" style={{ padding: '28px 22px' }}>
        <div className="text-center">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full"
            style={{ background: 'rgba(246,133,27,0.14)', border: '1px solid rgba(246,133,27,0.3)' }}>
            <Wallet size={18} style={{ color: '#F6851B' }} />
          </span>
          <h3 className="mb-1.5 text-sm font-bold" style={{ color: 'var(--text-1)' }}>
            Connect a wallet to swap
          </h3>
          <p className="mx-auto max-w-xs text-[12.5px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
            Link MetaMask on the Connections page to trade on-chain.
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <a href="/dashboard/apikeys" className="btn-primary inline-block px-5 py-2 text-[13px]">
              Go to Connections
            </a>
            <button onClick={() => setPaper(true)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
              style={{ color: '#fbbf24' }}>
              <FlaskConical size={12} /> Or try the playground — no wallet needed
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card glow-border" style={{ padding: '20px 22px' }}>
      {/* header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowDownUp size={15} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>On-chain Swap</h2>
          <span className="rounded border px-1.5 py-px font-mono text-[9.5px]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
            Uniswap V3
          </span>
        </div>
        <button onClick={() => setShowSettings((v) => !v)} className="rounded p-1.5"
          style={{ color: showSettings ? 'var(--accent)' : 'var(--text-3)' }}>
          <Settings2 size={15} />
        </button>
      </div>

      {/* mode: playground vs real money */}
      <div className="mb-3 flex gap-1 rounded-lg p-1"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <button onClick={() => { setPaper(true); setError(''); setStage('idle'); }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] font-semibold transition-all"
          style={{
            background: paper ? 'rgba(245,158,11,0.16)' : 'transparent',
            color: paper ? '#fbbf24' : 'var(--text-3)',
          }}>
          <FlaskConical size={12} /> Playground
        </button>
        <button onClick={() => { setPaper(false); setError(''); setStage('idle'); setPaperMsg(''); }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] font-semibold transition-all"
          style={{
            background: !paper ? 'var(--accent-dim)' : 'transparent',
            color: !paper ? 'var(--accent)' : 'var(--text-3)',
          }}>
          <Zap size={12} /> Live
        </button>
      </div>

      {paper && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold" style={{ color: '#fcd34d' }}>
              Simulated — real prices, fake money
            </p>
            <p className="font-mono text-[10.5px]" style={{ color: '#fbbf24', opacity: 0.8 }}>
              {paperAcct ? `${paperAcct.tradeCount ?? 0} trades` : 'loading…'}
            </p>
          </div>
          <button onClick={resetPaper}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-semibold"
            style={{ border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24' }}>
            <RotateCcw size={10} /> Reset
          </button>
        </div>
      )}

      {/* chain */}
      <div className="mb-3 flex gap-1 rounded-lg p-1"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {Object.entries(DEX).map(([id, c]) => {
          const active = chainId === Number(id);
          return (
            <button key={id} onClick={() => setChainId(Number(id))}
              className="flex-1 rounded-md px-2 py-1.5 text-[11.5px] font-semibold transition-all"
              style={{
                background: active ? (c.testnet ? 'rgba(245,158,11,0.16)' : 'var(--accent-dim)') : 'transparent',
                color: active ? (c.testnet ? '#fbbf24' : 'var(--accent)') : 'var(--text-3)',
              }}>
              {c.name}
            </button>
          );
        })}
      </div>

      {cfg?.testnet && (
        <div className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Info size={13} className="shrink-0" style={{ color: '#fbbf24' }} />
          <p className="text-[11.5px] font-semibold" style={{ color: '#fcd34d' }}>
            Testnet — play money. Nothing here has real value.
          </p>
        </div>
      )}

      {showSettings && (
        <div className="mb-3 rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="mb-2 text-[10.5px] font-bold tracking-wider" style={{ color: 'var(--text-3)' }}>
            SLIPPAGE TOLERANCE
          </div>
          <div className="flex gap-1.5">
            {SLIPPAGE_OPTS.map((s) => (
              <button key={s.bps} onClick={() => setSlippage(s.bps)}
                className="flex-1 rounded-md py-1.5 text-[11.5px] font-semibold transition-all"
                style={{
                  background: slippage === s.bps ? 'var(--accent-dim)' : 'transparent',
                  color: slippage === s.bps ? 'var(--accent)' : 'var(--text-3)',
                  border: `1px solid ${slippage === s.bps ? 'var(--border-hover)' : 'var(--border)'}`,
                }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* from */}
      <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10.5px] font-bold tracking-wider" style={{ color: 'var(--text-3)' }}>FROM</span>
          {paper ? (
            <button onClick={() => setAmount(String(paperBal))} className="text-[11px]" style={{ color: '#fbbf24' }}>
              Paper: {fmt(paperBal)} · MAX
            </button>
          ) : balIn != null ? (
            <button onClick={() => setAmount(balIn)} className="text-[11px]" style={{ color: 'var(--accent)' }}>
              Balance: {fmt(balIn)} · MAX
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number" inputMode="decimal" placeholder="0.0" value={amount} min="0"
            onChange={(e) => setAmount(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-mono text-[19px] font-semibold outline-none"
            style={{ color: 'var(--text-1)' }}
          />
          <select value={tokenIn} onChange={(e) => setTokenIn(e.target.value)}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-bold outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
            {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* flip */}
      <div className="relative z-10 -my-2 flex justify-center">
        <button onClick={flip}
          className="grid size-8 place-items-center rounded-lg transition-transform hover:rotate-180"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
          <ArrowDownUp size={14} />
        </button>
      </div>

      {/* to */}
      <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="mb-1.5 text-[10.5px] font-bold tracking-wider" style={{ color: 'var(--text-3)' }}>TO</div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 font-mono text-[19px] font-semibold"
            style={{ color: quote ? 'var(--text-1)' : 'var(--text-3)' }}>
            {quoting ? <RefreshCw size={16} className="animate-spin" /> : quote ? fmt(quote.amountOut) : '0.0'}
          </div>
          <select value={tokenOut} onChange={(e) => setTokenOut(e.target.value)}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-bold outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)' }}>
            {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* quote detail */}
      {quote && (
        <div className="mt-3 flex flex-col gap-1.5 rounded-lg p-3 text-[11.5px]"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          {[
            ['Rate', `1 ${tokenIn} ≈ ${fmt(quote.rate)} ${tokenOut}`],
            ['Pool fee', `${quote.feePercent}%`],
            ['Min received', `${fmt(quote.minAmountOut)} ${tokenOut}`],
            ['Slippage', `${quote.slippageBps / 100}%`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span style={{ color: 'var(--text-3)' }}>{k}</span>
              <span className="font-mono" style={{ color: 'var(--text-2)' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12.5px]"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5' }}>
          <AlertCircle size={14} className="mt-px shrink-0" /> {error}
        </div>
      )}

      {paper && paperMsg && (
        <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px]"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d' }}>
          <CheckCircle2 size={14} className="shrink-0" /> {paperMsg}
        </div>
      )}

      {!paper && stage === 'done' && txHash && (
        <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px]"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.28)', color: '#6ee7b7' }}>
          <CheckCircle2 size={14} className="shrink-0" />
          <span className="flex-1">Swap confirmed</span>
          <a href={`${cfg.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium">
            View <ExternalLink size={11} />
          </a>
        </div>
      )}

      <motion.button onClick={paper ? handlePaperSwap : handleSwap}
        disabled={!quote || busy || quoting || (paper && Number(amount) > paperBal)}
        whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-black transition disabled:opacity-50"
        style={{
          background: paper
            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
            : 'linear-gradient(90deg, #10b981, #06b6d4)',
          boxShadow: quote && !busy
            ? (paper ? '0 8px 26px -8px rgba(245,158,11,0.55)' : '0 8px 26px -8px rgba(16,185,129,0.55)')
            : 'none',
        }}>
        {busy && <RefreshCw size={15} className="animate-spin" />}
        {stage === 'approving' ? 'Approve in MetaMask…'
          : stage === 'swapping' ? (paper ? 'Simulating…' : 'Confirm swap in MetaMask…')
          : quoting ? 'Fetching quote…'
          : !amount ? 'Enter an amount'
          : paper && Number(amount) > paperBal ? `Not enough paper ${tokenIn}`
          : !quote ? 'No route'
          : paper ? `Simulate ${tokenIn} → ${tokenOut}` : `Swap ${tokenIn} → ${tokenOut}`}
      </motion.button>


      {paper && paperAcct?.balances && Object.keys(paperAcct.balances).length > 0 && (
        <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="mb-2 text-[10.5px] font-bold tracking-wider" style={{ color: 'var(--text-3)' }}>
            PAPER HOLDINGS
          </div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(paperAcct.balances)
              .filter(([, v]) => Number(v) > 0)
              .map(([sym, v]) => (
                <div key={sym} className="flex items-baseline justify-between">
                  <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-2)' }}>{sym}</span>
                  <span className="font-mono text-[12.5px]" style={{ color: 'var(--text-1)' }}>{fmt(v)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
      <div className="mt-3 flex gap-2 rounded-lg px-3 py-2"
        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)' }}>
        <Info size={13} className="mt-px shrink-0" style={{ color: '#fbbf24' }} />
        <p className="text-[11px] leading-relaxed" style={{ color: '#fcd34d' }}>
          {paper
            ? 'Playground: quotes are live Uniswap prices, but nothing is sent on-chain and no wallet signature is needed. Gas is not simulated.'
            : 'Manual only — you sign every swap. ERC-20 inputs need a one-time approval first, so the first trade of a token asks for two signatures.'}
        </p>
      </div>
    </div>
  );
}
