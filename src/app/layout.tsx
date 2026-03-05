import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import type React from 'react';
import './globals.css';
import { QueryProvider } from '@/components/query-provider';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Colourmap',
  description: 'See yourself clearly. Stay aligned with what matters.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark overflow-hidden" suppressHydrationWarning>
      <body
        className={`${geist.className} flex h-screen flex-col overflow-hidden antialiased`}
        suppressHydrationWarning
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
