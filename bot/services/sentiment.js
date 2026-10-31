import axios from 'axios';
import MarketSentiment from '../../lib/models/MarketSentiment.js';

/**
 * Sentiment is read from a per-symbol cache that a cron refreshes.
 *
 * It used to call Groq inline for every user × symbol — ~245 requests per
 * 5-minute tick across the user base, which the free tier answers with 429
 * ("Groq unavailable" in the logs). Sentiment for a symbol is the same for
 * everyone, so it is now computed once and shared.
 */

// Tried in order; first one that answers wins.
// gpt-oss-20b is primary: fast (~750ms) and honours JSON mode.
// gpt-oss-120b is deliberately excluded — it 400s on response_format.
export const MODEL_CHAIN = [
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
];

const NEUTRAL = { sentiment: 'neutral', confidence: 50, reason: 'No data' };

/** How long a cached entry stays usable by the bot. */
export const SENTIMENT_TTL_MS = 75 * 60 * 1000; // 75 min — covers a missed 30-min run

/* ── Read path (used by the bot, never calls Groq) ───────────────────────── */

export async function getSentiment(symbol, indicators) {
  try {
    const doc = await MarketSentiment.findOne({ symbol: symbol.toUpperCase() }).lean();

    if (doc) {
      const age = Date.now() - new Date(doc.refreshedAt).getTime();
      // Stale is still better than nothing — flag it rather than discarding.
      return {
        sentiment: doc.sentiment,
        confidence: age > SENTIMENT_TTL_MS ? Math.min(doc.confidence, 55) : doc.confidence,
        reason: age > SENTIMENT_TTL_MS ? `${doc.reason} (stale ${Math.round(age / 60000)}m)` : doc.reason,
        stale: age > SENTIMENT_TTL_MS,
        age,
      };
    }
  } catch (err) {
    console.warn('[Sentiment] cache read failed:', err.message);
  }

  // Nothing cached yet — derive something cheap from the indicators we already
  // have rather than blocking the tick on a network call.
  return derivedFromIndicators(indicators);
}

/** Crude local read so a cold cache still produces a usable signal. */
function derivedFromIndicators(ind) {
  if (!ind) return NEUTRAL;
  const bullish = ind.uptrend && ind.macroUptrend;
  const bearish = !ind.macroUptrend && ind.rsi > 55;
  if (bullish) return { sentiment: 'bullish', confidence: 55, reason: 'Trend up (local read, no AI)' };
  if (bearish) return { sentiment: 'bearish', confidence: 55, reason: 'Below EMA100 (local read, no AI)' };
  return { sentiment: 'neutral', confidence: 50, reason: 'Mixed signals (local read, no AI)' };
}

/* ── Write path (used by the cron) ───────────────────────────────────────── */

/* Keyless RSS sources. CryptoCompare was dropped — it now returns 401
   ("API key required") and was failing silently inside a catch, so sentiment
   had been running with no news at all. */
const NEWS_FEEDS = [
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed',
  'https://cryptoslate.com/feed/',
];

// Map a ticker to words that would appear in a headline about it.
const COIN_ALIASES = {
  BTC: ['bitcoin', 'btc'],
  ETH: ['ethereum', 'ether', 'eth'],
  SOL: ['solana', 'sol'],
  BNB: ['binance coin', 'bnb'],
  XRP: ['ripple', 'xrp'],
  DOGE: ['dogecoin', 'doge'],
  ADA: ['cardano', 'ada'],
  AVAX: ['avalanche', 'avax'],
  LINK: ['chainlink', 'link'],
  MATIC: ['polygon', 'matic'],
  POL: ['polygon', 'pol'],
  DOT: ['polkadot', 'dot'],
  SUI: ['sui'],
  PENGU: ['pudgy', 'pengu'],
};

function titlesFromRss(xml) {
  const out = [];
  // Feeds mix plain and CDATA titles; take both, skip the channel title.
  const re = /<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const t = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  return out;
}

let feedCache = { at: 0, titles: [] };

/** All recent headlines across feeds, cached briefly so one pass fetches once. */
async function allHeadlines() {
  if (Date.now() - feedCache.at < 10 * 60 * 1000 && feedCache.titles.length) {
    return feedCache.titles;
  }

  const results = await Promise.all(
    NEWS_FEEDS.map(async (url) => {
      try {
        const { data } = await axios.get(url, {
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrickyXBot/1.0)' },
          responseType: 'text',
        });
        return titlesFromRss(String(data));
      } catch {
        return [];
      }
    })
  );

  const titles = results.flat();
  if (titles.length) feedCache = { at: Date.now(), titles };
  return titles;
}

/** Headlines mentioning this coin, falling back to general market news. */
export async function fetchHeadlines(symbol, limit = 4) {
  const coin = symbol.replace(/USDT$/i, '').toUpperCase();
  const terms = COIN_ALIASES[coin] || [coin.toLowerCase()];

  const titles = await allHeadlines();
  if (!titles.length) return [];

  const matched = titles.filter((t) => {
    const low = t.toLowerCase();
    return terms.some((term) => low.includes(term));
  });

  // No coin-specific news is normal for small caps — give the model broad
  // market context rather than nothing.
  return (matched.length ? matched : titles).slice(0, limit);
}

async function callGroq(model, messages, timeout = 25000) {
  // response_format: json_object is NOT used — gpt-oss models reject it with
  // 400 "Failed to validate JSON". They are reasoning models, so max_tokens
  // must also cover the reasoning pass or content comes back empty.
  const { data } = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    { model, messages, temperature: 0.2, max_tokens: 400 },
    { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, timeout }
  );
  return data?.choices?.[0]?.message?.content?.trim();
}

/** Pull the JSON object out of a reply that may be fenced or prose-wrapped. */
function extractJson(raw) {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}

/**
 * Refresh one symbol's sentiment and persist it.
 * Walks MODEL_CHAIN so one model being busy doesn't kill the refresh.
 */
export async function refreshSentiment(symbol, indicators = null) {
  const sym = symbol.toUpperCase();
  const coin = sym.replace(/USDT$/i, '');

  if (!process.env.GROQ_API_KEY) {
    return { ...NEUTRAL, reason: 'No GROQ_API_KEY set', source: 'fallback' };
  }

  const headlines = await fetchHeadlines(sym, 4);

  const context = [
    headlines.length ? `Recent ${coin} headlines:\n- ${headlines.join('\n- ')}` : `No recent ${coin} news found.`,
    indicators
      ? `Technicals: RSI=${indicators.rsi}, MACD_hist=${indicators.macdHistogram}, ` +
        `trend=${indicators.uptrend ? 'UP' : 'DOWN'}, macro=${indicators.macroUptrend ? 'above EMA100' : 'below EMA100'}, ` +
        `volume=${indicators.volumeIncreasing ? 'rising' : 'flat'}`
      : null,
  ].filter(Boolean).join('\n\n');

  const messages = [
    {
      role: 'system',
      content:
        'You are a crypto market analyst. Weigh news first, technicals second. ' +
        'Respond ONLY with JSON: {"sentiment":"bullish|bearish|neutral","confidence":0-100,"reason":"under 15 words"}. ' +
        'Use confidence above 70 only when news and technicals agree.',
    },
    { role: 'user', content: `Assess ${coin} over the next few hours.\n\n${context}` },
  ];

  let lastErr = null;
  for (const model of MODEL_CHAIN) {
    try {
      const raw = await callGroq(model, messages);
      if (!raw) throw new Error('empty response');

      const parsed = extractJson(raw);
      if (!parsed) throw new Error('could not parse JSON from reply');
      const result = {
        sentiment: ['bullish', 'bearish', 'neutral'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
        confidence: Math.max(0, Math.min(100, parseInt(parsed.confidence, 10) || 50)),
        reason: String(parsed.reason || '').slice(0, 200),
        headlines,
        model,
        source: 'groq',
      };

      // Persist OUTSIDE the model try/catch below — a DB failure is not a
      // model failure, and conflating them hid a full-disk error as "Groq
      // unavailable" for every symbol.
      try {
        await MarketSentiment.findOneAndUpdate(
          { symbol: sym },
          { ...result, symbol: sym, refreshedAt: new Date() },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
      } catch (dbErr) {
        console.error(`[Sentiment] ${sym} analysed OK but could not be saved: ${dbErr.message}`);
        return { ...result, source: 'groq', persisted: false };
      }

      return { ...result, persisted: true };
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.error?.message || err.message;
      lastErr = `${model}: ${status || ''} ${String(detail).slice(0, 90)}`.trim();
      // Log every model's failure — reporting only the last one previously made
      // a 400 from the primary model look like a rate limit from the fallback.
      console.warn(`[Sentiment] ${sym} ${lastErr}`);
    }
  }

  console.warn(`[Sentiment] ${sym} refresh failed: ${lastErr}`);
  return { ...NEUTRAL, reason: `Groq unavailable (${lastErr})`, source: 'fallback' };
}

/* ── Decision helpers (unchanged semantics) ──────────────────────────────── */

export function shouldBlock(signal, sentiment) {
  return signal === 'BUY' && sentiment.sentiment === 'bearish' && sentiment.confidence >= 65;
}

export function shouldSellOnSentiment(sentiment) {
  return sentiment.sentiment === 'bearish' && sentiment.confidence >= 75;
}
