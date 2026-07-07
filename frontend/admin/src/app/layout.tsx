import type { Metadata } from 'next';
import { IBM_Plex_Mono, Public_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'RayFlow Admin',
  description: 'Flink、Fluss 与 Paimon 运维控制台',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${publicSans.variable} ${ibmPlexMono.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
