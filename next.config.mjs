import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Pin Turbopack's workspace root to this folder so Next doesn't get
  // confused by a stray ~/package-lock.json in the user's home dir.
  turbopack: {
    root: __dirname,
  },

  // Allow cross-origin dev resource loading from the local network IP.
  // Without this, Next 15+ blocks /_next/webpack-hmr from non-localhost
  // origins, breaking phone-on-Wi-Fi testing.
  allowedDevOrigins: ['10.7.12.49', '10.7.12.49:3001', '10.7.12.49:3000'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },

  // PWA-friendly headers for offline citizen flow
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
