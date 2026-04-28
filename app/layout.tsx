import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
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
  keywords: ['SANKALP', 'crisis response', 'disaster management', 'India', 'volunteer coordination', 'Gemini', 'Vertex AI'],
  themeColor: '#05060B',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#05060B',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable}`}>
      <body className="min-h-dvh bg-midnight-950 font-sans text-white">
        {children}
      </body>
    </html>
  );
}
