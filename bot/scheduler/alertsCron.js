/**
 * Price alerts — checked every minute.
 * One price request per market (all symbols at once), then every active alert
 * that crossed its level is claimed atomically and notified (push + email).
 */
import cron from 'node-cron';
import axios from 'axios';
import PriceAlert from '../../lib/models/PriceAlert.js';
import User from '../../lib/models/User.js';
import { sendPriceAlertEmail } from '../../lib/mail.js';

let running = false;

async function prices(market) {
  const url = market === 'futures'
    ? 'https://fapi.binance.com/fapi/v1/premiumIndex'
    : 'https://api.binance.com/api/v3/ticker/price';
  const { data } = await axios.get(url, { timeout: 15000 });
  return new Map(data.map(r => [r.symbol, parseFloat(market === 'futures' ? r.markPrice : r.price)]));
}

export async function checkAlerts() {
  if (running) return;
  running = true;
  try {
    const active = await PriceAlert.find({ status: 'active' }).limit(5000).lean();
    if (!active.length) return;

    const markets = [...new Set(active.map(a => a.market))];
    const px = {};
    for (const m of markets) {
      try { px[m] = await prices(m); } catch (e) { console.warn(`[Alerts] ${m} prices failed: ${e.message}`); }
    }

    let fired = 0;
    for (const a of active) {
      const p = px[a.market]?.get(a.symbol);
      if (!p) continue;
      const hit = a.condition === 'above' ? p >= a.price : p <= a.price;
      if (!hit) continue;

      // Claim it so a slow notification can never fire twice.
      const claimed = await PriceAlert.findOneAndUpdate(
        { _id: a._id, status: 'active' },
        { $set: { status: 'triggered', triggeredAt: new Date(), triggeredPrice: p } },
      );
      if (!claimed) continue;
      fired++;

      const title = `🔔 ${a.symbol} ${a.condition === 'above' ? '≥' : '≤'} $${a.price}`;
      const body = `Now $${p}${a.note ? ` — ${a.note}` : ''}`;
      try {
        const { sendPush } = await import('../../lib/fcm.js');
        await sendPush(a.userId, title, body, { type: 'price_alert', symbol: a.symbol });
      } catch { /* push is best-effort */ }
      const u = await User.findById(a.userId).select('email name').lean();
      if (u?.email) sendPriceAlertEmail(u.email, u.name || 'trader', a, p).catch(() => {});
    }
    if (fired) console.log(`[Alerts] ${fired} alert(s) triggered`);
  } catch (e) {
    console.error('[Alerts] check failed:', e.message);
  } finally {
    running = false;
  }
}

export function startAlertsScheduler() {
  cron.schedule('* * * * *', checkAlerts, { timezone: 'UTC' });
  console.log('[Alerts] Price alert checker started — every minute');
}
