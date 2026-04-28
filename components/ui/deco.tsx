'use client';

/**
 * SANKALP — Art Deco design primitives
 *
 * Small atoms grouped in a single module for ergonomic imports:
 *   import { Frame, CornerBrackets, SectionDivider, Eyebrow, RomanNumeral, GoldRule } from '@/components/ui/deco';
 *
 * Larger primitives (DecoButton, SunburstBackdrop) live in their own files.
 *
 * Design language:
 *   - Sharp 0px or 2px radius — never round
 *   - Gold (#D4AF37) borders are celebrated, not hidden
 *   - All-caps display type with wide tracking
 *   - Decorative L-bracket corners on framed exhibits
 *   - Glow > drop-shadow — gold halos, not black blur
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ───────────────────────────────────────────────────────────────────────────
// Frame — the canonical Art Deco card. Replaces .glass throughout.
// ───────────────────────────────────────────────────────────────────────────
export interface FrameProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual emphasis — `soft` for ambient panels, `strong` for primary
   *  containers, `double` for the Gatsby frame-within-a-frame look. */
  variant?: 'soft' | 'strong' | 'double';
  /** Renders the four L-bracket corner accents. */
  brackets?: boolean;
  /** Adds a hover state that intensifies the gold border. */
  interactive?: boolean;
}

export const Frame = forwardRef<HTMLDivElement, FrameProps>(function Frame(
  {
    variant = 'soft',
    brackets = false,
    interactive = false,
    className,
    children,
    ...rest
  },
  ref,
) {
  const variantClass =
    variant === 'strong'
      ? 'frame-strong'
      : variant === 'double'
        ? 'frame-double'
        : 'frame';

  return (
    <div
      ref={ref}
      className={cn(
        variantClass,
        'rounded-none',
        interactive && 'frame-hover cursor-pointer',
        className,
      )}
      {...rest}
    >
      {brackets && <CornerBrackets />}
      {children}
    </div>
  );
});

// ───────────────────────────────────────────────────────────────────────────
// CornerBrackets — four decorative L-shapes at the corners of a Frame.
// Pure decoration. Aria-hidden by default.
// ───────────────────────────────────────────────────────────────────────────
export function CornerBrackets({
  className,
  size = 'md',
}: {
  className?: string;
  /** L-bracket arm length. Defaults to medium (12px). */
  size?: 'sm' | 'md' | 'lg';
}) {
  // Literal class strings so Tailwind's JIT can detect them. No template
  // interpolation — JIT can't scan computed class names.
  const cfg =
    size === 'sm'
      ? {
          dim: 'h-2 w-2',
          tl: 'top-1.5 left-1.5 border-t border-l',
          tr: 'top-1.5 right-1.5 border-t border-r',
          bl: 'bottom-1.5 left-1.5 border-b border-l',
          br: 'bottom-1.5 right-1.5 border-b border-r',
        }
      : size === 'lg'
        ? {
            dim: 'h-4 w-4',
            tl: 'top-3 left-3 border-t border-l',
            tr: 'top-3 right-3 border-t border-r',
            bl: 'bottom-3 left-3 border-b border-l',
            br: 'bottom-3 right-3 border-b border-r',
          }
        : {
            dim: 'h-3 w-3',
            tl: 'top-2 left-2 border-t border-l',
            tr: 'top-2 right-2 border-t border-r',
            bl: 'bottom-2 left-2 border-b border-l',
            br: 'bottom-2 right-2 border-b border-r',
          };
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      <span className={cn('absolute border-gold-300/85', cfg.dim, cfg.tl)} />
      <span className={cn('absolute border-gold-300/85', cfg.dim, cfg.tr)} />
      <span className={cn('absolute border-gold-300/85', cfg.dim, cfg.bl)} />
      <span className={cn('absolute border-gold-300/85', cfg.dim, cfg.br)} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Eyebrow — the small uppercase label above a heading.
// "EXHIBIT I", "ARRIVAL HALL", "GOOGLE SOLUTION CHALLENGE · 2026", etc.
// ───────────────────────────────────────────────────────────────────────────
export function Eyebrow({
  children,
  className,
  tone = 'gold',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'gold' | 'muted';
}) {
  return (
    <div
      className={cn(
        'font-sans text-[10px] uppercase tracking-deco',
        tone === 'gold' ? 'text-gold-300' : 'text-pewter',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// GoldRule — the short centered horizontal divider.
// Gold gradient that fades at the edges. Pure decoration.
// ───────────────────────────────────────────────────────────────────────────
export function GoldRule({
  className,
  width = 'w-24',
}: {
  className?: string;
  width?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn('mx-auto h-px', width, className)}
      style={{
        background:
          'linear-gradient(90deg, transparent, rgba(212,175,55,0.85), transparent)',
      }}
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────
// SectionDivider — ornamental section heading: gold rule + display type +
// optional eyebrow. The "Act II" curtain rise that introduces a section.
// ───────────────────────────────────────────────────────────────────────────
export function SectionDivider({
  eyebrow,
  title,
  centered = true,
  className,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  centered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        centered && 'items-center text-center',
        className,
      )}
    >
      <GoldRule />
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      {title && (
        <h2 className="deco-display text-2xl text-champagne md:text-3xl">
          {title}
        </h2>
      )}
      <GoldRule />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// RomanNumeral — converts arabic to Roman numerals with the display font.
// Caps at 3999 (which is more than enough for hackathon enumeration).
// ───────────────────────────────────────────────────────────────────────────
const ROMAN_TABLE: Array<[number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'],  [90, 'XC'],  [50, 'L'],  [40, 'XL'],
  [10, 'X'],   [9, 'IX'],   [5, 'V'],   [4, 'IV'],
  [1, 'I'],
];

export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0 || n >= 4000) return String(n);
  let remainder = Math.floor(n);
  let out = '';
  for (const [value, glyph] of ROMAN_TABLE) {
    while (remainder >= value) {
      out += glyph;
      remainder -= value;
    }
  }
  return out;
}

export function RomanNumeral({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-display tracking-wide text-gold-300',
        className,
      )}
      aria-label={`${value}`}
    >
      {toRoman(value)}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// DecoDiamond — a 45° rotated square frame for icons / avatars.
// Children are counter-rotated so they remain upright inside the diamond.
// ───────────────────────────────────────────────────────────────────────────
export function DecoDiamond({
  children,
  className,
  size = 48,
}: {
  children: ReactNode;
  className?: string;
  size?: number;
}) {
  return (
    <div
      className={cn(
        'relative grid place-items-center border border-gold-300/70',
        'rotate-45 bg-charcoal shadow-glow-soft',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <div className="-rotate-45">{children}</div>
    </div>
  );
}
