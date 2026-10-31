import { JsonRpcProvider, Contract, parseUnits, formatUnits } from 'ethers';
import { DEX, FEE_TIERS, QUOTER_ABI, poolAddress, resolveToken } from '../lib/dex.js';

const chainId = 1;
const cfg = DEX[chainId];
const provider = new JsonRpcProvider(process.env.ETH_RPC_URL || 'https://eth.llamarpc.com', chainId);
const quoter = new Contract(cfg.quoter, QUOTER_ABI, provider);

const inTok = resolveToken(chainId, 'USDT');
const outTok = resolveToken(chainId, 'WETH');
const amtWei = parseUnits('1000', inTok.decimals);

console.log('quoting 1000 USDT -> WETH on Ethereum via QuoterV2...');
let best = null;
for (const fee of FEE_TIERS) {
  try {
    const r = await quoter.quoteExactInputSingle.staticCall({
      tokenIn: poolAddress(chainId, inTok.address),
      tokenOut: poolAddress(chainId, outTok.address),
      amountIn: amtWei, fee, sqrtPriceLimitX96: 0,
    });
    const out = formatUnits(r[0], outTok.decimals);
    console.log(`  fee ${String(fee).padStart(5)} -> ${out} WETH`);
    if (!best || r[0] > best.raw) best = { fee, raw: r[0], out };
  } catch (e) {
    console.log(`  fee ${String(fee).padStart(5)} -> no pool/liquidity`);
  }
}
if (best) {
  console.log(`\nBEST: fee ${best.fee} -> ${best.out} WETH`);
  console.log(`implied ETH price: $${(1000 / parseFloat(best.out)).toFixed(2)}`);
} else {
  console.log('\nFAIL: no route found');
}
