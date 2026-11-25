'use client';
import { cn } from '@/lib/utils';

/**
 * Infinite marquee scroller. Renders `items` through `renderItem`
 * (defaults to the Aceternity testimonial card).
 */
export const InfiniteMovingCards = ({
  items,
  direction = 'left',
  speed = 'fast',
  pauseOnHover = true,
  className,
  itemClassName,
  renderItem,
}) => {
  const duration = speed === 'fast' ? '20s' : speed === 'normal' ? '40s' : '80s';

  const renderList = (copy) =>
    items.map((item, idx) =>
      renderItem ? (
        <li key={`${copy}-${idx}`} aria-hidden={copy > 0 || undefined} className={cn('shrink-0', itemClassName)}>{renderItem(item)}</li>
      ) : (
        <li
          key={`${copy}-${item.name ?? idx}`}
          aria-hidden={copy > 0 || undefined}
          className="relative w-[340px] max-w-full shrink-0 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-7 py-6 md:w-[420px]"
        >
          <blockquote>
            <span className="relative z-20 text-sm leading-[1.6] font-normal text-neutral-200">
              {item.quote}
            </span>
            <div className="relative z-20 mt-5 flex flex-row items-center gap-3">
              {item.name && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 text-[11px] font-bold text-black">
                  {item.name.charAt(0)}
                </span>
              )}
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-neutral-200">{item.name}</span>
                <span className="text-xs text-neutral-500">{item.title}</span>
              </span>
            </div>
          </blockquote>
        </li>
      )
    );

  return (
    <div
      style={{
        '--animation-direction': direction === 'left' ? 'forwards' : 'reverse',
        '--animation-duration': duration,
      }}
      className={cn(
        'scroller relative z-20 w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_15%,white_85%,transparent)]',
        className
      )}
    >
      <ul
        className={cn(
          'flex w-max min-w-full shrink-0 flex-nowrap gap-4 py-4 animate-scroll',
          pauseOnHover && 'hover:[animation-play-state:paused]'
        )}
      >
        {renderList(0)}
        {renderList(1)}
      </ul>
    </div>
  );
};
