'use client';

import { useEffect } from 'react';
import { PageError } from '@/components/ui/page-error';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  const isNetworkError =
    error.message?.includes('fetch') ||
    error.message?.includes('Network') ||
    error.message?.includes('Cannot reach server');

  return (
    <div
      className="flex min-h-screen items-center justify-center p-8"
      style={{ backgroundColor: '#0a0a0f', color: '#ffffff' }}
    >
      <div className="w-full max-w-md">
        <PageError
          title={isNetworkError ? 'Сервер недоступен' : 'Что-то пошло не так'}
          message={error.message}
          onRetry={reset}
          backHref="/"
        />
      </div>
    </div>
  );
}
