'use client';

import { useEffect } from 'react';
import { PageError } from '@/components/ui/page-error';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="p-8">
      <PageError
        title="Ошибка дашборда"
        message={error.message}
        onRetry={reset}
        backHref="/dashboard"
      />
    </div>
  );
}
