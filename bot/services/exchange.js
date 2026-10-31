import * as binance  from './binance.js';
import * as bingx    from './bingx.js';
import * as metamask from './metamask.js';

const REGISTRY = { binance, bingx, metamask };

export function getExchange(name) {
  return REGISTRY[name] ?? binance;
}

/** True for venues whose orders must be signed in the user's browser. */
export function requiresClientSignature(name) {
  return Boolean(getExchange(name).REQUIRES_CLIENT_SIGNATURE);
}

export const EXCHANGES = Object.keys(REGISTRY);
