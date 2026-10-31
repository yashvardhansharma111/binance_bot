/**
 * Uniswap V3 swap plumbing.
 *
 * Deliberately keyless — quotes come straight from the on-chain QuoterV2 over
 * the RPC URLs already configured, so no aggregator subscription is needed.
 * The trade-off is Uniswap-only routing rather than best-price aggregation
 * across every DEX; swap in 1inch/0x later if that matters.
 */

export const NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'; // sentinel for ETH/BNB/POL

/** Uniswap V3 fee tiers, probed cheapest-first when quoting. */
export const FEE_TIERS = [500, 3000, 10000];

export const DEX = {
  // Sepolia testnet — free faucet funds, real Uniswap V3 contracts.
  // Use this to rehearse the whole flow before touching mainnet.
  11155111: {
    name: 'Sepolia',
    testnet: true,
    native: { symbol: 'ETH', decimals: 18 },
    wrapped: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    router:  '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
    quoter:  '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3',
    explorer: 'https://sepolia.etherscan.io',
    tokens: {
      ETH:  { address: NATIVE,                                       decimals: 18 },
      WETH: { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18 },
      USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6  },
    },
  },
  1: {
    name: 'Ethereum',
    native: { symbol: 'ETH', decimals: 18 },
    wrapped: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    router:  '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // SwapRouter02
    quoter:  '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // QuoterV2
    explorer: 'https://etherscan.io',
    tokens: {
      ETH:  { address: NATIVE,                                       decimals: 18 },
      WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
      USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6  },
      USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6  },
      WBTC: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8  },
      DAI:  { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
    },
  },
  56: {
    name: 'BNB Chain',
    native: { symbol: 'BNB', decimals: 18 },
    wrapped: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    router:  '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2',
    quoter:  '0x78D78E420Da98ad378D7799bE8f4AF69033EB077',
    explorer: 'https://bscscan.com',
    tokens: {
      BNB:  { address: NATIVE,                                       decimals: 18 },
      WBNB: { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18 },
      USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
      USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
      BTCB: { address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18 },
      ETH:  { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18 },
    },
  },
  137: {
    name: 'Polygon',
    native: { symbol: 'POL', decimals: 18 },
    wrapped: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    router:  '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    quoter:  '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    explorer: 'https://polygonscan.com',
    tokens: {
      POL:    { address: NATIVE,                                       decimals: 18 },
      WMATIC: { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18 },
      USDT:   { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6  },
      USDC:   { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6  },
      WETH:   { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
    },
  },
};

export const QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)',
];

export const ROUTER_ABI = [
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
];

export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function approve(address spender,uint256 amount) returns (bool)',
];

export const isNative = (addr) => String(addr).toLowerCase() === NATIVE.toLowerCase();

/** Resolve a user-facing symbol (or raw address) to { address, decimals }. */
export function resolveToken(chainId, symbolOrAddress) {
  const cfg = DEX[chainId];
  if (!cfg) throw new Error(`Unsupported chain ${chainId}`);
  const key = String(symbolOrAddress || '').trim();

  if (/^0x[a-fA-F0-9]{40}$/.test(key)) return { address: key, decimals: null };
  const t = cfg.tokens[key.toUpperCase()];
  if (!t) throw new Error(`Unknown token "${key}" on ${cfg.name}`);
  return { ...t, symbol: key.toUpperCase() };
}

/** Native coins must be routed through their wrapped ERC-20 inside a pool. */
export const poolAddress = (chainId, addr) =>
  isNative(addr) ? DEX[chainId].wrapped : addr;
