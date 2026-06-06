'use client';
import { useEffect, useState } from 'react';
import { BarChart2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

const SIDES = ['ALL', 'BUY', 'SELL'];

export default function TradePage() {
  const [trades,  setTrades]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('ALL');
  const [page,    setPage]    = useState(1);
  const limit = 20;

  async function load(p = 1) {
    setLoading(true);
    const res  = await fetch(`/api/trades?page=${p}&limit=${limit}`);
    const data = await res.json();
    setTrades(data.trades || []);
    setTotal(data.total || 0);
    setPage(p);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = filter === 'ALL' ? trades : trades.filter(t => t.side === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recent Trades</h1>
          <p className="text-slate-500 mt-0.5 text-sm">{total} total trades</p>
        </div>
        <button onClick={() => load(page)} className="btn-outline py-2 px-4 flex items-center gap-2 text-sm">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-5">
        {SIDES.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
            style={{
              background: filter === s ? 'white' : 'transparent',
              color:      filter === s ? '#0f172a' : '#64748b',
              boxShadow:  filter === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {s}
          </button>
        ))}
      </div>

      <div className="card glow-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw size={22} className="text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <BarChart2 size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No trades found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Symbol', 'Side', 'Price', 'Qty', 'Total', 'P&L', 'Opened', 'Closed', 'Status'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(trade => (
                  <tr key={trade._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-mono font-semibold text-slate-900">{trade.symbol}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        trade.side === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                      }`}>{trade.side}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-800">${trade.price?.toFixed(4)}</td>
                    <td className="px-5 py-4 text-slate-600">{trade.qty}</td>
                    <td className="px-5 py-4 text-slate-600">${(trade.total || trade.price * trade.qty)?.toFixed(2)}</td>
                    <td className="px-5 py-4">
                      <span className={`font-semibold flex items-center gap-1 ${trade.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {trade.profit >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {trade.profit >= 0 ? '+' : ''}{trade.profit?.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                      <div>{new Date(trade.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-slate-400">{new Date(trade.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                      {trade.closedAt ? (
                        <>
                          <div>{new Date(trade.closedAt).toLocaleDateString()}</div>
                          <div className="text-xs text-slate-400">{new Date(trade.closedAt).toLocaleTimeString()}</div>
                        </>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        trade.status === 'closed' ? 'bg-slate-100 text-slate-500'
                          : trade.status === 'open' ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-600'
                      }`}>{trade.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > limit && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <span className="text-slate-500 text-sm">Page {page} of {Math.ceil(total / limit)}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => load(page - 1)}
                className="btn-outline py-1.5 px-3 text-sm disabled:opacity-40">Prev</button>
              <button disabled={page >= Math.ceil(total / limit)} onClick={() => load(page + 1)}
                className="btn-outline py-1.5 px-3 text-sm disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
