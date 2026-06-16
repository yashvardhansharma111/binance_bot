import axios from 'axios';

export async function getSentiment(symbol, indicators) {
  if (!process.env.GROQ_API_KEY) {
    return { sentiment: 'neutral', confidence: 50, reason: 'No GROQ_API_KEY set' };
  }

  const coin = symbol.replace('USDT', '');
  let headlines = null;

  try {
    const { data } = await axios.get(
      `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${coin}&limit=6&sortOrder=latest`,
      { timeout: 8000 }
    );
    headlines = data.Data.slice(0, 5).map(n => n.title).join('\n');
  } catch { /* news fetch optional */ }

  const context = headlines
    ? `Latest ${coin} news:\n${headlines}`
    : `Technical: RSI=${indicators.rsi}, trend=${indicators.uptrend ? 'UP' : 'DOWN'}`;

  try {
    const { data } = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a crypto sentiment analyzer. Reply ONLY with valid JSON: {"sentiment":"bullish","confidence":75,"reason":"under 12 words"}. sentiment must be bullish, bearish, or neutral.',
          },
          { role: 'user', content: `Analyze ${coin} market sentiment. ${context}` },
        ],
        temperature: 0.1,
        max_tokens: 80,
      },
      {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        timeout: 12000,
      }
    );

    const parsed = JSON.parse(data.choices[0].message.content.trim());
    return {
      sentiment:  parsed.sentiment  || 'neutral',
      confidence: parseInt(parsed.confidence) || 50,
      reason:     parsed.reason     || '',
    };
  } catch (err) {
    console.warn('[Sentiment] Groq error:', err.message);
    return { sentiment: 'neutral', confidence: 50, reason: 'Groq unavailable' };
  }
}

// Block BUY when sentiment is strongly bearish
export function shouldBlock(signal, sentiment) {
  return signal === 'BUY' && sentiment.sentiment === 'bearish' && sentiment.confidence >= 65;
}

// Exit open position when sentiment turns strongly bearish
export function shouldSellOnSentiment(sentiment) {
  return sentiment.sentiment === 'bearish' && sentiment.confidence >= 75;
}
