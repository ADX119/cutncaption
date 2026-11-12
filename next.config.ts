import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // Production headers come from public/_headers (Cloudflare Pages). The dev
  // server does not read that file, so mirror the isolation headers here.
  ...(isDev && {
    async headers() {
      const coep = { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' };
      return [
        {
          source: '/tools/:path*',
          headers: [{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }, coep],
        },
        { source: '/_next/static/:path*', headers: [coep] },
        { source: '/vendor/:path*', headers: [coep] },
      ];
    },
  }),
};

export default nextConfig;
