import type { Metadata, Viewport } from 'next';
import { Anek_Latin } from 'next/font/google';
import type { ReactNode } from 'react';
import { AnalyticsBeacon, SiteFooter, SiteHeader } from '@/components';
import { t } from '@/i18n';
import { THEME_INIT_SCRIPT } from '@/lib';
import { toolPath } from '@/seo';
import './globals.css';

// Self-hosted at build time; no request goes to a font CDN from the browser.
const anek = Anek_Latin({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-anek',
  display: 'swap',
});

export const metadata: Metadata = {
  title: t('app.name'),
  description: t('app.tagline'),
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6f3' },
    { media: '(prefers-color-scheme: dark)', color: '#101412' },
  ],
};

const NAV = [
  // Only tools that work today; meme, captions and crop join as they ship.
  { href: toolPath('trim-video'), label: t('nav.trim') },
  { href: toolPath('compress-video'), label: t('nav.compress') },
  { href: toolPath('convert-to-mp4'), label: t('nav.convert') },
  { href: toolPath('video-to-mp3'), label: t('nav.mp3') },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The init script sets data-theme before hydration, so the attribute may differ.
    <html lang="en" className={anek.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <SiteHeader nav={NAV} />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <AnalyticsBeacon token={process.env.NEXT_PUBLIC_CF_BEACON_TOKEN} />
      </body>
    </html>
  );
}
