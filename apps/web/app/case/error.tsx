'use client';

import { useEffect } from 'react';
import { PageError } from '@/components/ui/page-error';

export default function CaseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Case error:', error);
  }, [error]);

  return (
    <div className="p-8">
      <PageError
        title="Ошибка дела"
        message={error.message}
        onRetry={reset}
        backHref="/case"
      />
    </div>
  );
}
