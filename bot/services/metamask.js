/**
 * MetaMask / on-chain venue.
 *
 * Implements the same surface as binance.js and bingx.js so getExchange() can
 * return it interchangeably — but with one unavoidable difference:
 *
 *   READS  (candles, prices, balances)  work server-side.
 *   WRITES (buy/sell) DO NOT and CANNOT work server-side.
 *
 * A MetaMask private key never leaves the user's device, so there is no
 * credential the server could hold to sign a swap. Orders must be built here
 * and signed in the browser by the user. The write functions therefore throw a
 * tagged error instead of silently doing nothing, so callers (the bot cron in
 * particular) fail loudly rather than appearing to trade.
 */
import { JsonRpcProvider, Contract, formatUnits } from 'ethers';
import * as binance from './binance.js';

export const IS_ONCHAIN = true;
export const REQUIRES_CLIENT_SIGNATURE = true;

export class ClientSignatureRequired extends Error {
  constructor(action) {
    super(
      `"${action}" must be signed in the user's wallet — MetaMask cannot be traded from the server. ` +
      `Use the on-chain swap flow in the browser, or grant an ERC-7715 session key.`
    );
    this.name = 'ClientSignatureRequired';
    this.code = 'CLIENT_SIGNATURE_REQUIRED';
  }
}

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export const CHAINS = {
  11155111: {
    name: 'Sepolia',
    testnet: true,
    native: 'ETH',
    rpc: () => process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    stable: { symbol: 'USDC', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
    tokens: {
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    },
  },
  1: {
    name: 'Ethereum',
    native: 'ETH',
    rpc: () => process.env.ETH_RPC_URL || 'https://ethereum-rpc.publicnode.com',
    stable: { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    tokens: {
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    },
  },
  56: {
    name: 'BNB Chain',
    native: 'BNB',
    rpc: () => process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    stable: { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    tokens: {
      USDT: '0x55d398326f99059fF775485246999027B3197955',
      USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      BTCB: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    },
  },
  137: {
    name: 'Polygon',
    native: 'POL',
    rpc: () => process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com',
    stable: { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    tokens: {
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    },
  },
};

export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || 1);

function chainOf(chainId = DEFAULT_CHAIN_ID) {
  const c = CHAINS[chainId];
  if (!c) throw new Error(`Unsupported chain ${chainId}`);
  return c;
}

function providerFor(chainId = DEFAULT_CHAIN_ID) {
  const c = chainOf(chainId);
  return new JsonRpcProvider(c.rpc(), chainId);
}

/* ── Reads ────────────────────────────────────────────────────────────────
   Price history for a DEX pair would need a subgraph or an indexer. Until one
   is wired up these reuse Binance's public market data, which needs no key and
   tracks the same assets closely enough for indicator maths. This is a
   deliberate approximation, not a live DEX pool price. */

export async function getCandles(symbol, interval = '5m', limit = 100) {
  return binance.getCandles(symbol, interval, limit);
}

export async function getCurrentPrice(symbol) {
  return binance.getCurrentPrice(symbol);
}

/** Stablecoin balance of the wallet — the on-chain analogue of USDT balance. */
export async function getUSDTBalance(walletAddress, _unused, chainId = DEFAULT_CHAIN_ID) {
  if (!walletAddress) return 0;
  const c = chainOf(chainId);
  const provider = providerFor(chainId);
  const token = new Contract(c.stable.address, ERC20_ABI, provider);
  const raw = await token.balanceOf(walletAddress);
  return parseFloat(formatUnits(raw, c.stable.decimals));
}

/** Balance of one asset, e.g. "WETH" or a raw 0x address. */
export async function getAssetBalance(walletAddress, _unused, symbol, chainId = DEFAULT_CHAIN_ID) {
  if (!walletAddress) return 0;
  const c = chainOf(chainId);
  const provider = providerFor(chainId);

  const base = String(symbol).replace(/USDT$/i, '').toUpperCase();
  const address = /^0x[a-fA-F0-9]{40}$/.test(symbol) ? symbol : c.tokens[base];
  if (!address) return 0;

  const token = new Contract(address, ERC20_ABI, provider);
  const [raw, dec] = await Promise.all([token.balanceOf(walletAddress), token.decimals()]);
  return parseFloat(formatUnits(raw, dec));
}

/* ── Writes — server-side execution is impossible by design ──────────────── */

export async function placeMarketBuy() {
  throw new ClientSignatureRequired('placeMarketBuy');
}

export async function placeMarketSell() {
  throw new ClientSignatureRequired('placeMarketSell');
}
