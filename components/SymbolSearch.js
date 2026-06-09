'use client';
import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

let cachedSymbols = null;
let cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export default function SymbolSearch({ value, onChange, size = 'md' }) {
  const [symbols,  setSymbols]  = useState(cachedSymbols || []);
  const [query,    setQuery]    = useState('');
  const [open,     setOpen]     = useState(false);
  const containerRef = useRef(null);
  const inputRef     = useRef(null);

  useEffect(() => {
    if (cachedSymbols && Date.now() - cacheTs < CACHE_TTL) return;
    fetch('/api/symbols')
      .then(r => r.json())
      .then(d => {
        cachedSymbols = d.symbols || [];
        cacheTs = Date.now();
        setSymbols(cachedSymbols);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handle(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setQuery('');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const base     = value.replace(/USDT$/, '');
  const upper    = query.toUpperCase();
  const filtered = upper
    ? symbols.filter(s => s.replace(/USDT$/, '').includes(upper))
    : symbols;

  const btnPad = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm';

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 rounded-lg border font-bold transition-all ${btnPad}`}
        style={{
          background:  'var(--surface-2)',
          borderColor: open ? 'var(--accent)' : 'var(--border)',
          color:       'var(--text-1)',
          minWidth:    100,
        }}
      >
        <span>{base}</span>
        <span className="text-xs font-normal" style={{ color: 'var(--text-3)' }}>/USDT</span>
        <ChevronDown size={12} className="ml-auto" style={{ color: 'var(--text-3)' }} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 z-50 rounded-xl shadow-2xl overflow-hidden"
          style={{ width: 260, background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="p-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
              <Search size={12} style={{ color: 'var(--text-3)' }} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search e.g. ZEC, DOGE…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-xs"
                style={{ color: 'var(--text-1)' }}
              />
              {query && (
                <button onClick={() => setQuery('')}>
                  <X size={11} style={{ color: 'var(--text-3)' }} />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-3)' }}>
                No pairs match "{query}"
              </div>
            ) : filtered.map(s => {
              const coin   = s.replace('USDT', '');
              const active = s === value;
              return (
                <button
                  key={s}
                  onClick={() => { onChange(s); setOpen(false); setQuery(''); }}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold transition-colors"
                  style={{
                    background: active ? 'var(--accent-dim)' : 'transparent',
                    color:      active ? 'var(--accent)' : 'var(--text-1)',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span>{coin}</span>
                  <span className="font-normal" style={{ color: 'var(--text-3)' }}>USDT</span>
                </button>
              );
            })}
          </div>

          {!query && (
            <div className="px-4 py-1.5 text-[10px]" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)' }}>
              {filtered.length} pairs — type to filter
            </div>
          )}
        </div>
      )}
    </div>
  );
}
