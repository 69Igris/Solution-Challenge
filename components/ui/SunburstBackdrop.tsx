'use client';

/**
 * SANKALP — SunburstBackdrop
 *
 * The iconic Art Deco sunburst — radiating gold rays from a focal point.
 * Drawn as an SVG so it can scale infinitely while staying crisp, with
 * subtle motion that breathes (opacity oscillation, very slow).
 *
 * Use as a positioned-absolute decorative layer behind hero content:
 *
 *   <section className="relative">
 *     <SunburstBackdrop />
 *     <h1>SANKALP</h1>
 *   </section>
 */

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SunburstBackdropProps {
  /** Number of rays. 24 is canonical Art Deco. */
  rays?: number;
  /** Maximum opacity at the centre (rays gradient to transparent). */
  intensity?: number;
  /** Fix the backdrop in viewport coords vs. local. */
  fixed?: boolean;
  className?: string;
}

export function SunburstBackdrop({
  rays = 24,
  intensity = 0.18,
  fixed = false,
  className,
}: SunburstBackdropProps) {
  const reduceMotion = useReducedMotion();

  // Pre-compute ray angles. Each ray is a triangle pointing inward.
  const angles = Array.from({ length: rays }, (_, i) => (360 / rays) * i);

  return (
    <div
      aria-hidden
      className={cn(
        fixed ? 'fixed' : 'absolute',
        'inset-0 -z-10 overflow-hidden pointer-events-none',
        className,
      )}
    >
      <motion.svg
        viewBox="-100 -100 200 200"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        initial={{ opacity: intensity }}
        animate={
          reduceMotion
            ? undefined
            : { opacity: [intensity, intensity * 1.8, intensity] }
        }
        transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
      >
        <defs>
          <radialGradient id="sankalp-sunburst-fade" cx="50%" cy="0%" r="60%">
            <stop offset="0%"  stopColor="#D4AF37" stopOpacity="0.85" />
            <stop offset="40%" stopColor="#D4AF37" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </radialGradient>
        </defs>

        {angles.map((a) => (
          <polygon
            key={a}
            points="0,0 1.6,-160 -1.6,-160"
            transform={`rotate(${a})`}
            fill="url(#sankalp-sunburst-fade)"
          />
        ))}

        {/* Central halo */}
        <circle r="3" fill="#D4AF37" opacity="0.85" />
        <circle r="8" fill="none" stroke="#D4AF37" strokeWidth="0.4" opacity="0.50" />
        <circle r="14" fill="none" stroke="#D4AF37" strokeWidth="0.3" opacity="0.30" />
      </motion.svg>
    </div>
  );
}
