'use client';

import { useEffect } from 'react';
import { PageError } from '@/components/ui/page-error';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin error:', error);
  }, [error]);

  return (
    <div className="p-8">
      <PageError
        title="Admin error"
        message={error.message}
        onRetry={reset}
        backHref="/admin/dashboard"
      />
    </div>
  );
}
