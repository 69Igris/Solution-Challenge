import type { Config } from 'tailwindcss';

/**
 * SANKALP — Art Deco Tailwind Theme
 *
 * The "Gatsby" aesthetic: obsidian black, metallic gold, geometric precision.
 * Existing token names (midnight.*, sankalp.*, severity.*) are preserved but
 * redirected to Art Deco values, so existing components automatically inherit
 * the new palette without code changes. Refactors happen on a per-page basis.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ─────────── Core Art Deco palette ───────────
        obsidian: '#0A0A0A',          // background
        charcoal: '#141414',          // raised surface
        champagne: '#F2F0E4',         // primary text
        pewter: '#888888',            // muted text

        // The hero accent — metallic gold scale
        gold: {
          50:  '#FAF4D8',
          100: '#F2E8C4',
          200: '#E5D599',
          300: '#D4AF37',             // primary accent
          400: '#C09B2C',
          500: '#D4AF37',
          600: '#B89530',
          700: '#92741F',
          800: '#6B5519',
          900: '#4D3D12',
          DEFAULT: '#D4AF37',
        },

        // Secondary — vintage midnight blue
        deco: {
          blue: '#1E3D59',            // secondary accent
          blueLight: '#2C5478',
          blueDark: '#13283B',
        },

        // ─────────── Legacy aliases — redirected to Art Deco ───────────
        // (so existing components keep working visually)
        midnight: {
          950: '#0A0A0A',              // obsidian — page bg
          900: '#0A0A0A',
          800: '#141414',              // charcoal — panels
          700: '#1A1A1A',
          600: '#262626',
          500: '#1E3D59',              // deco midnight blue
        },

        // The product was indigo; now it's gold. Same brand, new metal.
        sankalp: {
          50:  '#FAF4D8',
          100: '#F2E8C4',
          200: '#E5D599',
          300: '#D4AF37',
          400: '#C09B2C',
          500: '#D4AF37',
          600: '#B89530',
          700: '#92741F',
          800: '#6B5519',
          900: '#4D3D12',
        },

        // Severity — desaturated to jewel tones that sit inside the Art Deco
        // palette without losing functional clarity.
        severity: {
          medical:    '#E63950',       // deep crimson (was candy pink-red)
          evacuation: '#7C3AED',       // aubergine purple
          shelter:    '#1E3D59',       // deco midnight blue
          food:       '#D4AF37',       // gold-amber (now matches accent)
          resolved:   '#708A65',       // sage instead of emerald — vintage
        },
      },

      fontFamily: {
        // Display — Marcellus is a serif with classical Roman structure +
        // Art Deco flair. Used for all-caps headings.
        display: ['var(--font-display)', 'Marcellus', 'ui-serif', 'Georgia', 'serif'],
        // Body — Josefin Sans is geometric, vintage, immediately recognizable.
        sans: ['var(--font-sans)', 'Josefin Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Mono — kept for diagnostic numerics on the dashboard.
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      letterSpacing: {
        deco: '0.18em',
        'deco-wide': '0.24em',
      },

      backgroundImage: {
        // The hero sunburst — gold radial from top, dissolving into obsidian
        sunburst:
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(212,175,55,0.18) 0%, rgba(10,10,10,0) 55%), ' +
          'radial-gradient(ellipse 60% 50% at 50% 110%, rgba(30,61,89,0.20) 0%, rgba(10,10,10,0) 55%)',

        // Diagonal crosshatch — Art Deco's signature subtle texture
        crosshatch:
          'repeating-linear-gradient(45deg, rgba(212,175,55,0.04) 0px, rgba(212,175,55,0.04) 1px, transparent 1px, transparent 8px), ' +
          'repeating-linear-gradient(-45deg, rgba(212,175,55,0.04) 0px, rgba(212,175,55,0.04) 1px, transparent 1px, transparent 8px)',

        // Metallic sheen — for buttons and gold borders
        'gold-sheen':
          'linear-gradient(135deg, #F2E8C4 0%, #D4AF37 35%, #92741F 70%, #D4AF37 100%)',

        // Glass sheen retained but tinted gold
        'glass-sheen':
          'linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(212,175,55,0.01) 50%, rgba(212,175,55,0.04) 100%)',
      },

      boxShadow: {
        // ─────── Gold glows replace soft drop-shadows entirely ───────
        // Subtle gold halo for cards
        'glow-soft':  '0 0 16px rgba(212,175,55,0.15)',
        // Standard gold glow — buttons, framed cards on hover
        'glow-gold':  '0 0 20px rgba(212,175,55,0.35), 0 0 40px rgba(212,175,55,0.10)',
        // Intense — primary CTAs, focal points
        'glow-grand': '0 0 30px rgba(212,175,55,0.50), 0 0 60px rgba(212,175,55,0.15)',

        // Severity glows — used on the SOS button + map markers
        'glow-sos':
          '0 0 0 1px rgba(230,57,80,0.40), 0 20px 60px -10px rgba(230,57,80,0.45), 0 0 120px 8px rgba(230,57,80,0.25)',

        // Legacy alias — redirected to gold
        'glow-brand': '0 0 20px rgba(212,175,55,0.35), 0 0 40px rgba(212,175,55,0.10)',

        // Inner-glow for gold borders (the "etched" feeling)
        'inner-gold': 'inset 0 0 0 1px rgba(212,175,55,0.30)',

        // Glass — kept for compatibility but with gold inner highlight
        glass:
          'inset 0 1px 0 0 rgba(212,175,55,0.10), 0 8px 32px -8px rgba(0,0,0,0.7)',
      },

      keyframes: {
        'pulse-ring': {
          '0%':   { transform: 'scale(1)',    opacity: '0.55' },
          '100%': { transform: 'scale(1.85)', opacity: '0'    },
        },
        'slow-spin': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'gold-shimmer': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.55' },
        },
        'sunburst-pulse': {
          '0%, 100%': { opacity: '0.18' },
          '50%':      { opacity: '0.32' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        'pulse-ring':      'pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slow-spin':       'slow-spin 24s linear infinite',
        'gold-shimmer':    'gold-shimmer 3.6s ease-in-out infinite',
        'sunburst-pulse':  'sunburst-pulse 6s ease-in-out infinite',
        shimmer:           'shimmer 2.4s linear infinite',
      },

      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
