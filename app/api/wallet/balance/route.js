import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { JsonRpcProvider, formatEther, formatUnits, Contract } from 'ethers';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

/* Chains we read balances on. RPC URLs are overridable via env; the defaults
   are public endpoints that are fine for occasional reads but rate-limited —
   set the env vars for production. */
const CHAINS = {
  11155111: {
    name: 'Sepolia',
    native: 'ETH',
    rpc: () => process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    tokens: [
      { symbol: 'USDC', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' },
      { symbol: 'WETH', address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' },
    ],
  },
  1: {
    name: 'Ethereum',
    native: 'ETH',
    rpc: () => process.env.ETH_RPC_URL || 'https://ethereum-rpc.publicnode.com',
    tokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    ],
  },
  56: {
    name: 'BNB Chain',
    native: 'BNB',
    rpc: () => process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    tokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955' },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' },
    ],
  },
  137: {
    name: 'Polygon',
    native: 'POL',
    rpc: () => process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com',
    tokens: [
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
      { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
    ],
  },
};

const isAddress = (a) => typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a);

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address') || session.user.walletAddress;
    const chainId = Number(searchParams.get('chainId') || 1);

    if (!isAddress(address)) {
      return NextResponse.json({ error: 'No wallet address' }, { status: 400 });
    }
    const chain = CHAINS[chainId];
    if (!chain) {
      return NextResponse.json(
        { error: `Unsupported chain ${chainId}`, supported: Object.keys(CHAINS).map(Number) },
        { status: 400 }
      );
    }

    const provider = new JsonRpcProvider(chain.rpc(), chainId);

    const [nativeWei, ...tokenResults] = await Promise.all([
      provider.getBalance(address),
      ...chain.tokens.map(async (t) => {
        try {
          const c = new Contract(t.address, ERC20_ABI, provider);
          const [raw, dec] = await Promise.all([c.balanceOf(address), c.decimals()]);
          return { symbol: t.symbol, balance: formatUnits(raw, dec) };
        } catch {
          return { symbol: t.symbol, balance: null };
        }
      }),
    ]);

    return NextResponse.json({
      address,
      chainId,
      chain: chain.name,
      native: { symbol: chain.native, balance: formatEther(nativeWei) },
      tokens: tokenResults,
    });
  } catch (err) {
    console.error('[wallet/balance]', err.message);
    return NextResponse.json({ error: 'Could not read balances' }, { status: 500 });
  }
}
