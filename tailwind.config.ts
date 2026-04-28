import type { Config } from 'tailwindcss';

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
        // SANKALP midnight palette — deep, warm-cool dark with intentional accents.
        midnight: {
          950: '#05060B', // deepest background
          900: '#0A0B14', // app background
          800: '#0F1120', // panel background
          700: '#161A2E', // raised panel
          600: '#1E2440', // border / divider
          500: '#2A3157', // hover
        },
        // Severity / urgency channel — used across map pulses and KPIs
        severity: {
          medical: '#FF3D6E',     // red-pink — life-threatening medical
          evacuation: '#A855F7',  // violet — evacuation
          shelter: '#3B82F6',     // blue — shelter
          food: '#F59E0B',        // amber — food/water
          resolved: '#10B981',    // emerald — match completed
        },
        // Brand accent — indigo-cyan gradient endpoints
        sankalp: {
          50: '#EEF1FF',
          100: '#D9DEFF',
          200: '#B4BCFF',
          300: '#8E9AFF',
          400: '#6878FF',
          500: '#4C5BFF', // primary brand
          600: '#3B47E5',
          700: '#2E37B8',
          800: '#232A8C',
          900: '#1A1F66',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        'midnight-radial':
          'radial-gradient(ellipse at top, rgba(76,91,255,0.10) 0%, rgba(5,6,11,0) 55%), radial-gradient(ellipse at bottom, rgba(255,61,110,0.06) 0%, rgba(5,6,11,0) 55%)',
        'glass-sheen':
          'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 50%, rgba(255,255,255,0.04) 100%)',
      },
      boxShadow: {
        'glow-sos':
          '0 0 0 1px rgba(255,61,110,0.35), 0 20px 60px -10px rgba(255,61,110,0.45), 0 0 120px 8px rgba(255,61,110,0.25)',
        'glow-brand':
          '0 0 0 1px rgba(76,91,255,0.30), 0 20px 60px -10px rgba(76,91,255,0.40)',
        'glass':
          'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 8px 32px -8px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '100%': { transform: 'scale(1.85)', opacity: '0' },
        },
        'slow-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slow-spin': 'slow-spin 24s linear infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
