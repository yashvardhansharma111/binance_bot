import mongoose from 'mongoose';

/**
 * Sentiment cached per SYMBOL, not per user.
 *
 * Sentiment for BTCUSDT is identical for every user, so calling Groq once per
 * user per tick burned ~245 requests every 5 minutes and tripped the free-tier
 * rate limit (429). A background cron refreshes this collection instead and
 * the bot reads from here.
 */
const MarketSentimentSchema = new mongoose.Schema({
  symbol:     { type: String, required: true, unique: true, uppercase: true, index: true },
  sentiment:  { type: String, enum: ['bullish', 'bearish', 'neutral'], default: 'neutral' },
  confidence: { type: Number, default: 50 },
  reason:     { type: String, default: '' },

  // What the model was given, kept for debugging a bad call.
  headlines:  { type: [String], default: [] },
  model:      { type: String, default: '' },
  source:     { type: String, enum: ['groq', 'fallback', 'stale'], default: 'groq' },

  refreshedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

export default mongoose.models.MarketSentiment
  || mongoose.model('MarketSentiment', MarketSentimentSchema);
