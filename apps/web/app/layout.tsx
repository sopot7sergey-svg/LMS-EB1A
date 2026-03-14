import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Aipas - Build Your Extraordinary Ability Petition',
  description: 'AI-assisted course to build a submission-ready EB-1A I-140 petition package',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" style={{ backgroundColor: '#0a0a0f', color: '#ffffff' }}>
      <body style={{ backgroundColor: '#0a0a0f', color: '#ffffff' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
