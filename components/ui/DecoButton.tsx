'use client';

/**
 * SANKALP — DecoButton
 *
 * Architectural button. Sharp corners, gold borders, all-caps text with
 * wide tracking, glow on hover. The Art Deco answer to default Tailwind
 * pill buttons.
 *
 * Three variants:
 *   - default  → transparent w/ gold 2px border, fills gold on hover
 *   - solid    → gold background, obsidian text
 *   - outline  → 1px gold border, transparent, fills deco-blue on hover
 *
 * Three sizes:
 *   - sm  → h-9, text-xs
 *   - md  → h-12, text-sm  (default — meets 48px touch target)
 *   - lg  → h-14, text-base
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DecoButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'solid' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const DecoButton = forwardRef<HTMLButtonElement, DecoButtonProps>(
  function DecoButton(
    {
      variant = 'default',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const sizeClass =
      size === 'sm'
        ? 'h-9 px-4 text-xs'
        : size === 'lg'
          ? 'h-14 px-8 text-base'
          : 'h-12 px-6 text-sm';

    const variantClass =
      variant === 'solid'
        ? // Gold background, obsidian text
          'bg-gold-300 text-obsidian border-2 border-gold-300 hover:bg-gold-100 hover:border-gold-100'
        : variant === 'outline'
          ? // Thin border, transparent. Fills deco-blue on hover.
            'bg-transparent text-gold-300 border border-gold-300/70 hover:bg-deco-blue hover:text-champagne hover:border-deco-blue'
          : // Default — transparent, 2px gold border, fills gold on hover.
            'bg-transparent text-gold-300 border-2 border-gold-300 hover:bg-gold-300 hover:text-obsidian';

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // Base
          'relative inline-flex items-center justify-center gap-2 rounded-none',
          'font-sans font-semibold uppercase tracking-deco',
          'select-none whitespace-nowrap',
          'transition-all duration-300 ease-out',
          // Glow ring on hover (Art Deco — never drop-shadow)
          'hover:shadow-glow-gold',
          // Focus state — gold ring offset for keyboard nav
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian',
          // Disabled
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none',
          sizeClass,
          variantClass,
          className,
        )}
        {...rest}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
        ) : (
          children
        )}
      </button>
    );
  },
);
