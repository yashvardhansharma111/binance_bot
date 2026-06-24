import * as binance from './binance.js';
import * as bingx   from './bingx.js';

export function getExchange(name) {
  return name === 'bingx' ? bingx : binance;
}
