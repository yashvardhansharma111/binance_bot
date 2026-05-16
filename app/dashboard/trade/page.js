'use client';
import { useEffect, useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
import axios from 'axios';

const SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','DOGEUSDT','XRPUSDT','ADAUSDT'];

export default function ManualTradePage() {
  const [symbol,  setSymbol]  = useState('BTCUSDT');
  const [side,    setSide]    = useState('BUY');
  const [amount,  setAmount]  = useState('');     // USDT for BUY
  const [qty,     setQty]     = useState('');     // coin qty for SELL
  const [sl,      setSl]      = useState('');     // stop loss %
  const [tp,      setTp]      = useState('');     // take profit %
  const [price,   setPrice]   = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState('');
  const [openPos, setOpenPos] = useState(null);

  useEffect(() => { fetchPrice(); fetchBalance(); fetchOpen(); }, [symbol]);

  async function fetchPrice() {
    setPrice(null);
    const res  = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const data = await res.json();
    setPrice(parseFloat(data.price));
  }

  async function fetchBalance() {
    const res  = await fetch('/api/balance');
    const data = await res.json();
    setBalance(data);
  }

  async function fetchOpen() {
    const res  = await fetch(`/api/trades?symbol=${symbol}&status=open&limit=1`);
    const data = await res.json();
    setOpenPos(data.trades?.[0] || null);
  }

  async function placeOrder() {
    setError(''); setResult(null);
    if (side === 'BUY' && (!amount || parseFloat(amount) < 1)) {
      setError('Enter USDT amount (min $1)'); return;
    }
    setLoading(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);

      const res = await fetch('/api/trade/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          symbol, side,
          usdtAmount:        side === 'BUY' ? parseFloat(amount) : undefined,
          qty:               side === 'SELL' && qty ? parseFloat(qty) : undefined,
          stopLossPercent:   sl ? parseFloat(sl) : undefined,
          takeProfitPercent: tp ? parseFloat(tp) : undefined,
        }),
      });
      clearTimeout(timer);

      let data;
      try {
        data = await res.json();
      } catch {
        setError(`Server error (HTTP ${res.status}) — order may or may not have been placed. Check History.`);
        return;
      }

      if (!res.ok) { setError(data.error || 'Order failed'); return; }
      setResult(data);
      setAmount(''); setQty('');
      fetchBalance(); fetchOpen();
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request timed out (20s) — check History to see if the order was placed.');
      } else {
        setError(`Network error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const usdtBal = balance?.balances?.find(b => b.asset === 'USDT')?.free || 0;
  const coinBal = balance?.balances?.find(b => b.asset === symbol.replace('USDT',''))?.free || 0;
  const estQty  = price && amount ? (parseFloat(amount) / price).toFixed(6) : '—';
  const estVal  = price && qty    ? (parseFloat(qty) * price).toFixed(2)   : '—';

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 lg:text-2xl flex items-center gap-2">
          <Zap size={20} className="text-blue-500" /> Manual Trade
        </h1>
        <p className="text-slate-500 mt-0.5 text-xs lg:text-sm">Place market orders directly on Binance</p>
      </div>

      {/* Pair selector */}
      <div className="card glow-border p-4 mb-4">
        <div className="text-xs font-semibold text-slate-500 mb-2">Select Pair</div>
        <div className="flex flex-wrap gap-1.5">
          {SYMBOLS.map(s => (
            <button key={s} onClick={() => setSymbol(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
              style={{
                background:  symbol === s ? '#0f172a' : '#f8fafc',
                color:       symbol === s ? '#fff' : '#64748b',
                borderColor: symbol === s ? '#0f172a' : '#e2e8f0',
              }}>
              {s.replace('USDT', '')}
            </button>
          ))}
        </div>
        {price && (
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
            <span className="text-xs text-slate-400">{symbol}</span>
            <button onClick={fetchPrice} className="ml-auto text-xs text-blue-500 hover:underline">Refresh</button>
          </div>
        )}
      </div>

      {/* Open position alert */}
      {openPos && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Open {symbol} position: <strong>{openPos.qty} @ ${openPos.price?.toFixed(2)}</strong>
            {openPos.stopLoss && ` | SL: $${openPos.stopLoss}`}
            {openPos.takeProfit && ` | TP: $${openPos.takeProfit}`}
          </span>
        </div>
      )}

      {/* BUY / SELL tabs */}
      <div className="card glow-border p-5 space-y-4">
        <div className="flex gap-2">
          <button onClick={() => setSide('BUY')}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold border-2 transition-all"
            style={{
              background:  side === 'BUY' ? '#16a34a' : '#f0fdf4',
              color:       side === 'BUY' ? '#fff' : '#16a34a',
              borderColor: '#16a34a',
            }}>
            <ArrowUpCircle size={15} className="inline mr-1.5" />BUY
          </button>
          <button onClick={() => setSide('SELL')}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold border-2 transition-all"
            style={{
              background:  side === 'SELL' ? '#dc2626' : '#fef2f2',
              color:       side === 'SELL' ? '#fff' : '#dc2626',
              borderColor: '#dc2626',
            }}>
            <ArrowDownCircle size={15} className="inline mr-1.5" />SELL
          </button>
        </div>

        {/* Balance info */}
        <div className="flex justify-between text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
          <span>USDT available: <strong className="text-slate-700">${usdtBal.toFixed(2)}</strong></span>
          <span>{symbol.replace('USDT','')} held: <strong className="text-slate-700">{coinBal.toFixed(6)}</strong></span>
        </div>

        {side === 'BUY' ? (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Amount to spend (USDT)</label>
            <input type="number" min="1" placeholder="e.g. 100"
              value={amount} onChange={e => setAmount(e.target.value)}
              className="input w-full" />
            <div className="text-xs text-slate-400 mt-1.5">
              You will receive ≈ <strong>{estQty}</strong> {symbol.replace('USDT','')}
            </div>
            <div className="flex gap-2 mt-2">
              {[25,50,75,100].map(pct => (
                <button key={pct} onClick={() => setAmount((usdtBal * pct / 100).toFixed(2))}
                  className="flex-1 py-1 text-xs font-semibold rounded border border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-colors">
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Qty to sell ({symbol.replace('USDT','')}) — leave blank to sell open position
            </label>
            <input type="number" min="0" placeholder={`e.g. ${coinBal.toFixed(4) || '0.001'}`}
              value={qty} onChange={e => setQty(e.target.value)}
              className="input w-full" />
            {qty && <div className="text-xs text-slate-400 mt-1.5">≈ <strong>${estVal}</strong> USDT</div>}
          </div>
        )}

        {/* Risk controls */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Stop Loss % <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-1">
              <input type="number" min="0.1" max="50" step="0.1" placeholder="e.g. 2"
                value={sl} onChange={e => setSl(e.target.value)}
                className="input flex-1 text-sm" />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Take Profit % <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-1">
              <input type="number" min="0.1" max="100" step="0.1" placeholder="e.g. 4"
                value={tp} onChange={e => setTp(e.target.value)}
                className="input flex-1 text-sm" />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {result && (
          <div className="px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
            <CheckCircle2 size={14} />
            {result.trade.side} {result.order.qty} {symbol.replace('USDT','')} @ ${result.order.price?.toLocaleString()}
            {result.trade.stopLoss && ` | SL: $${result.trade.stopLoss}`}
            {result.trade.takeProfit && ` | TP: $${result.trade.takeProfit}`}
          </div>
        )}

        <button onClick={placeOrder} disabled={loading}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
          style={{
            background: side === 'BUY' ? '#16a34a' : '#dc2626',
            color: '#fff',
          }}>
          {loading
            ? <RefreshCw size={16} className="animate-spin" />
            : side === 'BUY' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />
          }
          {loading ? 'Placing order...' : `Place ${side} Order`}
        </button>

        <p className="text-xs text-center text-slate-400">
          Market order — executes immediately at current price.
          {process.env.NODE_ENV !== 'production' && ' DRY RUN mode active.'}
        </p>
      </div>
    </div>
  );
}
