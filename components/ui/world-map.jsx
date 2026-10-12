'use client';

import { useRef, useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import DottedMap from 'dotted-map';
import { useTheme } from '@/app/ThemeContext';

export default function WorldMap({
  dots = [],
  lineColor = '#0ea5e9',
  dotColor,
  mapBackgroundColor = 'transparent',
  // Dot density. The generated SVG is inlined as a data URI, and cost scales
  // steeply: 100 ≈ 940KB encoded, 48 ≈ 220KB. Drop it for decorative use.
  height = 100,
  // Defer generation until near the viewport, keeping it out of the SSR HTML.
  lazy = false,
  className,
}) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const { theme } = useTheme();
  const [ready, setReady] = useState(!lazy);

  useEffect(() => {
    if (!lazy || ready) return;
    const el = wrapRef.current;

    // Backstop: generate anyway if the observer never fires (unsupported,
    // zero-height at observe time, or the section starts in view).
    const fallback = setTimeout(() => setReady(true), 1500);

    if (!el || typeof IntersectionObserver === 'undefined') {
      return () => clearTimeout(fallback);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px' }
    );
    io.observe(el);

    return () => {
      clearTimeout(fallback);
      io.disconnect();
    };
  }, [lazy, ready]);

  // DottedMap rasterises the whole grid, so keep it out of the render path.
  const svgMap = useMemo(() => {
    if (!ready) return null;
    const map = new DottedMap({ height, grid: 'diagonal' });
    return map.getSVG({
      radius: 0.22,
      color: dotColor ?? (theme === 'dark' ? '#FFFFFF40' : '#00000040'),
      shape: 'circle',
      backgroundColor: mapBackgroundColor,
    });
  }, [ready, theme, dotColor, mapBackgroundColor, height]);

  const projectPoint = (lat, lng) => ({
    x: (lng + 180) * (800 / 360),
    y: (90 - lat) * (400 / 180),
  });

  const createCurvedPath = (start, end) => {
    const midX = (start.x + end.x) / 2;
    const midY = Math.min(start.y, end.y) - 50;
    return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
  };

  return (
    <div ref={wrapRef} className={`relative aspect-[2/1] w-full font-sans ${className ?? ''}`}>
      {svgMap && (
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
          className="pointer-events-none h-full w-full select-none opacity-0 transition-opacity duration-1000 [mask-image:linear-gradient(to_bottom,transparent,white_10%,white_90%,transparent)]"
          alt="world map"
          height="495"
          width="1056"
          draggable={false}
          onLoad={(e) => { e.currentTarget.style.opacity = '1'; }}
        />
      )}

      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      >
        {dots.map((dot, i) => {
          const startPoint = projectPoint(dot.start.lat, dot.start.lng);
          const endPoint = projectPoint(dot.end.lat, dot.end.lng);
          return (
            <g key={`path-group-${i}`}>
              <motion.path
                d={createCurvedPath(startPoint, endPoint)}
                fill="none"
                stroke="url(#path-gradient)"
                strokeWidth="1"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, delay: 0.35 * i, ease: 'easeOut' }}
              />
            </g>
          );
        })}

        <defs>
          <linearGradient id="path-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="5%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="95%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>

        {dots.map((dot, i) => (
          <g key={`points-group-${i}`}>
            {[dot.start, dot.end].map((point, j) => {
              const p = projectPoint(point.lat, point.lng);
              return (
                <g key={`pt-${i}-${j}`}>
                  <circle cx={p.x} cy={p.y} r="2" fill={lineColor} />
                  <circle cx={p.x} cy={p.y} r="2" fill={lineColor} opacity="0.5">
                    <animate attributeName="r" from="2" to="8" dur="1.5s" begin="0s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" begin="0s" repeatCount="indefinite" />
                  </circle>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}
