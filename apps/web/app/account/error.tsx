'use client';

import { useEffect } from 'react';
import { PageError } from '@/components/ui/page-error';

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Account error:', error);
  }, [error]);

  return (
    <div className="p-8">
      <PageError
        title="Ошибка аккаунта"
        message={error.message}
        onRetry={reset}
        backHref="/account"
      />
    </div>
  );
}
