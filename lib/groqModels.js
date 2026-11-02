/**
 * Groq models, tried in order — first one that answers wins.
 *
 * Shared by the sentiment cron and the support chat so neither can drift onto
 * a model that is deprecated or out of quota. Kept dependency-free so an API
 * route can import it without pulling in mongoose.
 *
 * Notes from live testing:
 *  - gpt-oss-* are reasoning models: they need generous max_tokens or the
 *    content comes back empty, and they reject response_format: json_object
 *    with a 400.
 *  - qwen's daily request quota (1000) runs out quickly and resets after 24h,
 *    so it must never be the only model.
 */
export const MODEL_CHAIN = [
  'openai/gpt-oss-20b',   // primary — fast (~750ms)
  'openai/gpt-oss-120b',  // fallback — slower but reliable
  'qwen/qwen3.8-27b',     // last resort — quota-limited
];

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
