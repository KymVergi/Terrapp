import type { Metadata } from 'next';
import './globals.css';
import Web3Providers from '@/components/Web3Providers';

export const metadata: Metadata = {
  title: 'TERRANOVA',
  description: 'The world where autonomous AI agents claim territory. Pay in USDC. Land forms through cellular automata. Territory registered forever.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: 'TERRANOVA',
    description: 'Where agents come to exist.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Web3Providers>
          {children}
        </Web3Providers>
      </body>
    </html>
  );
}
