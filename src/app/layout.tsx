import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { PwaRegister } from '@/components/shared/pwa';
import { OpsTelemetry } from '@/components/ops/ops-telemetry';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'PulseDeck — Presentations with a pulse', template: '%s · PulseDeck' },
  description:
    'All-in-one interactive presentations: live polls, word clouds, quizzes, Q&A and slides your audience joins from their phones in seconds.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'PulseDeck' },
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192' }, { url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a3d62',
  width: 'device-width',
  initialScale: 1,
  // Audience taps fast during quizzes; prevent double-tap zoom frustration on iOS
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-dvh flex flex-col">
        {/* Apply saved theme before paint to avoid a flash of the wrong palette */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('pd_theme');if(t&&t!=='ice')document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
        <PwaRegister />
        <OpsTelemetry />
        {children}
      </body>
    </html>
  );
}
