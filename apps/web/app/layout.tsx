import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Aipas — Соберите петицию EB-1A',
  description: 'AI-курс для подготовки submission-ready EB-1A I-140 пакета',
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
    <html lang="ru" className="dark" style={{ backgroundColor: '#0a0a0f', color: '#ffffff' }}>
      <body style={{ backgroundColor: '#0a0a0f', color: '#ffffff' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
