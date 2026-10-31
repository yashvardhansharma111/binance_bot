'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAddress } from 'ethers';

const METAMASK_RDNS = 'io.metamask';

/**
 * Wallet hook with EIP-6963 multi-provider discovery.
 *
 * Relying on `window.ethereum` alone breaks in browsers that ship their own
 * wallet (Brave, Opera) — whichever injects last wins, so MetaMask can be
 * installed yet invisible. EIP-6963 has each wallet announce itself instead,
 * letting us pick MetaMask explicitly. `window.ethereum` stays as a fallback
 * for older builds.
 */
export function useWallet() {
  const [address, setAddress]       = useState(null);
  const [chainId, setChainId]       = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [providers, setProviders]   = useState([]); // [{ info, provider }]
  const [ready, setReady]           = useState(false);
  const providerRef = useRef(null);

  /* ── discover wallets ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const found = new Map();

    const onAnnounce = (event) => {
      const { info, provider } = event.detail || {};
      if (!info?.rdns || found.has(info.rdns)) return;
      found.set(info.rdns, { info, provider });
      setProviders(Array.from(found.values()));
    };

    window.addEventListener('eip6963:announceProvider', onAnnounce);
    // Ask any already-loaded wallets to re-announce.
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // Extensions can inject after hydration, so settle shortly after mount.
    const t = setTimeout(() => setReady(true), 350);

    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      clearTimeout(t);
    };
  }, []);

  /** MetaMask if present, else any announced wallet, else window.ethereum. */
  const pickProvider = useCallback(() => {
    const mm = providers.find((p) => p.info.rdns === METAMASK_RDNS);
    if (mm) return mm.provider;
    if (providers.length) return providers[0].provider;

    const eth = typeof window !== 'undefined' ? window.ethereum : null;
    if (!eth) return null;
    // Some browsers expose several providers behind one object.
    if (Array.isArray(eth.providers)) {
      return eth.providers.find((p) => p.isMetaMask) || eth.providers[0];
    }
    return eth;
  }, [providers]);

  const hasProvider = providers.length > 0 ||
    (typeof window !== 'undefined' && Boolean(window.ethereum));

  const metaMaskFound = providers.some((p) => p.info.rdns === METAMASK_RDNS) ||
    (typeof window !== 'undefined' && Boolean(window.ethereum?.isMetaMask));

  /* ── reflect an already-authorised account ───────────────────────────── */
  useEffect(() => {
    const eth = pickProvider();
    if (!eth) return;
    providerRef.current = eth;

    eth.request({ method: 'eth_accounts' })
      .then((accs) => { if (accs?.length) setAddress(accs[0].toLowerCase()); })
      .catch(() => {});
    eth.request({ method: 'eth_chainId' })
      .then(setChainId)
      .catch(() => {});

    const onAccounts = (accs) => setAddress(accs?.length ? accs[0].toLowerCase() : null);
    const onChain = (id) => setChainId(id);

    eth.on?.('accountsChanged', onAccounts);
    eth.on?.('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, [pickProvider]);

  const connect = useCallback(async () => {
    const eth = pickProvider();
    if (!eth) throw new Error('NO_PROVIDER');
    providerRef.current = eth;

    setConnecting(true);
    try {
      const accs = await eth.request({ method: 'eth_requestAccounts' });
      const addr = accs?.[0]?.toLowerCase();
      if (!addr) throw new Error('No account returned');
      setAddress(addr);
      setChainId(await eth.request({ method: 'eth_chainId' }).catch(() => null));
      return addr;
    } finally {
      setConnecting(false);
    }
  }, [pickProvider]);

  /** Sign a SIWE message. Returns { message, signature }. */
  const signSiwe = useCallback(async (addr) => {
    const eth = providerRef.current || pickProvider();
    if (!eth) throw new Error('NO_PROVIDER');

    const res = await fetch('/api/auth/wallet/nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: addr }),
    });
    const { nonce, error } = await res.json();
    if (!res.ok) throw new Error(error || 'Could not get nonce');

    const payload = {
      domain: window.location.host,
      address: toChecksum(addr),
      statement: 'Sign in to TrickyX.ai. This request will not trigger a transaction or cost any gas.',
      uri: window.location.origin,
      version: '1',
      chainId: parseInt(await eth.request({ method: 'eth_chainId' }), 16) || 1,
      nonce,
      issuedAt: new Date().toISOString(),
    };

    const { SiweMessage } = await import('siwe');
    const prepared = new SiweMessage(payload).prepareMessage();

    const signature = await eth.request({
      method: 'personal_sign',
      params: [prepared, addr],
    });

    return { message: JSON.stringify(payload), signature };
  }, [pickProvider]);

  return {
    address, chainId, connecting,
    hasProvider, metaMaskFound, ready, providers,
    getProvider: pickProvider,
    connect, signSiwe,
  };
}

/** EIP-55 checksum — SIWE rejects a non-checksummed address. */
function toChecksum(addr) {
  try { return getAddress(addr); } catch { return addr; }
}
