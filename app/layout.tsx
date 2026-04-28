import type { Metadata, Viewport } from 'next';
import { Marcellus, Josefin_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

/**
 * SANKALP — Art Deco font stack
 *   - Marcellus (display)  → all-caps, classical Roman structure with deco flair
 *   - Josefin Sans (body)  → geometric, vintage, immediately recognisable
 *   - JetBrains Mono       → kept for tabular numerics on the dashboard
 */
const display = Marcellus({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Josefin_Sans({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'SANKALP — India\'s AI Conductor for Crisis Response',
    template: '%s · SANKALP',
  },
  description:
    'AI-powered crisis response platform that bridges Indians in distress with India\'s 10-million-strong volunteer base. Built for the Google Solution Challenge 2026.',
  applicationName: 'SANKALP',
  authors: [{ name: 'Team NexusFlow' }],
  keywords: [
    'SANKALP',
    'crisis response',
    'disaster management',
    'India',
    'volunteer coordination',
    'Gemini',
    'Vertex AI',
  ],
  // themeColor moved to `viewport` export below per Next 14+ requirements.
  // manifest: PWA web manifest will land in Sprint 5; reference removed
  // until /public/manifest.webmanifest is authored.
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A0A0A',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <body className="min-h-dvh bg-obsidian font-sans text-champagne">
        {children}
      </body>
    </html>
  );
}
