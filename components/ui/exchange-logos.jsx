'use client';
import React from 'react';

/* Binance mark — five rhombi. Brand yellow #F0B90B. */
export function BinanceMark({ className, size = 22 }) {
  const d = (cx, cy, s) => `M${cx} ${cy - s}L${cx + s} ${cy}L${cx} ${cy + s}L${cx - s} ${cy}Z`;
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true">
      <g fill="#F0B90B">
        <path d={d(16, 6.4, 4.4)} />
        <path d={d(6.4, 16, 4.4)} />
        <path d={d(25.6, 16, 4.4)} />
        <path d={d(16, 25.6, 4.4)} />
        <path d={d(16, 16, 5.7)} />
      </g>
    </svg>
  );
}

export function BinanceLogo({ className }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <BinanceMark />
      <span className="text-[15px] font-semibold tracking-tight text-neutral-200">Binance</span>
    </span>
  );
}

/* BingX mark — crossed strokes. Brand blue #2354E6. */
export function BingXMark({ className, size = 22 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true">
      <path d="M3.5 5.5h7.2L28.5 26.5h-7.2z" fill="#2354E6" />
      <path d="M28.5 5.5h-7.2L3.5 26.5h7.2z" fill="#4D7CFF" opacity="0.9" />
    </svg>
  );
}

export function BingXLogo({ className }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <BingXMark />
      <span className="text-[15px] font-semibold tracking-tight text-neutral-200">BingX</span>
    </span>
  );
}
