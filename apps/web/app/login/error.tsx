'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { PageError } from '@/components/ui/page-error';

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Login error:', error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen items-center justify-center p-8"
      style={{ backgroundColor: '#0a0a0f', color: '#ffffff' }}
    >
      <div className="w-full max-w-md">
        <PageError
          title="Ошибка входа"
          message={error.message}
          onRetry={reset}
          backHref="/"
        />
        <p className="mt-4 text-center text-sm" style={{ color: '#a1a1aa' }}>
          <Link href="/" className="underline hover:no-underline">На главную</Link>
        </p>
      </div>
    </div>
  );
}
