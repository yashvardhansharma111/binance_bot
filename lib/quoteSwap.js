import { JsonRpcProvider, Contract, parseUnits, formatUnits } from 'ethers';
import {
  DEX, FEE_TIERS, QUOTER_ABI, ERC20_ABI,
  resolveToken, poolAddress, isNative,
} from '@/lib/dex';
import { CHAINS } from '@/bot/services/metamask';

/**
 * Quotes a Uniswap V3 swap on-chain via QuoterV2, probing every fee tier and
 * returning the best fill. Shared by the live swap route and the paper-trading
 * route so simulated fills use exactly the same prices as real ones.
 */
export async function quoteSwap({ chainId = 1, tokenIn, tokenOut, amountIn, slippageBps = 50 }) {
  const cfg = DEX[chainId];
  if (!cfg) throw Object.assign(new Error(`Unsupported chain ${chainId}`), { status: 400 });
  if (!amountIn || Number(amountIn) <= 0) {
    throw Object.assign(new Error('Enter an amount'), { status: 400 });
  }

  const inTok  = resolveToken(chainId, tokenIn);
  const outTok = resolveToken(chainId, tokenOut);

  const rpc = CHAINS[chainId]?.rpc?.();
  const provider = new JsonRpcProvider(rpc, chainId);

  for (const t of [inTok, outTok]) {
    if (t.decimals == null) {
      const c = new Contract(t.address, ERC20_ABI, provider);
      t.decimals = Number(await c.decimals());
    }
  }

  const amtWei  = parseUnits(String(amountIn), inTok.decimals);
  const fromAddr = poolAddress(chainId, inTok.address);
  const toAddr   = poolAddress(chainId, outTok.address);

  if (fromAddr.toLowerCase() === toAddr.toLowerCase()) {
    throw Object.assign(new Error('Pick two different tokens'), { status: 400 });
  }

  const quoter = new Contract(cfg.quoter, QUOTER_ABI, provider);

  // QuoterV2 mutates state internally — must be probed with staticCall.
  const probes = await Promise.all(FEE_TIERS.map(async (fee) => {
    try {
      const r = await quoter.quoteExactInputSingle.staticCall({
        tokenIn: fromAddr, tokenOut: toAddr, amountIn: amtWei, fee, sqrtPriceLimitX96: 0,
      });
      return { fee, amountOut: r[0], gasEstimate: r[3] };
    } catch {
      return null;
    }
  }));

  const best = probes.filter(Boolean).sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1))[0];
  if (!best) {
    throw Object.assign(new Error('No liquidity for this pair on Uniswap V3'), { status: 404 });
  }

  const bps = BigInt(Math.max(1, Math.min(5000, Number(slippageBps))));
  const minOut = (best.amountOut * (10000n - bps)) / 10000n;
  const outHuman = formatUnits(best.amountOut, outTok.decimals);

  return {
    chainId,
    chain: cfg.name,
    testnet: Boolean(cfg.testnet),
    tokenIn:  { ...inTok,  pool: fromAddr },
    tokenOut: { ...outTok, pool: toAddr },
    amountIn: String(amountIn),
    amountInWei: amtWei.toString(),
    amountOut: outHuman,
    amountOutWei: best.amountOut.toString(),
    minAmountOut: formatUnits(minOut, outTok.decimals),
    minAmountOutWei: minOut.toString(),
    rate: Number(outHuman) / Number(amountIn),
    fee: best.fee,
    feePercent: best.fee / 10000,
    slippageBps: Number(bps),
    gasEstimate: best.gasEstimate?.toString() ?? null,
    router: cfg.router,
    needsApproval: !isNative(inTok.address),
    explorer: cfg.explorer,
  };
}
