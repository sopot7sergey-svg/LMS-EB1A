'use client';

import Link from 'next/link';
import { Button } from './button';

interface PageErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  backHref?: string;
}

export function PageError({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  backHref = '/dashboard',
}: PageErrorProps) {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-4 rounded-lg border border-border bg-background-secondary p-8 text-center">
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm text-foreground-secondary">{message}</p>
      <div className="flex gap-3">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Link href={backHref}>
          <Button variant="secondary">Go back</Button>
        </Link>
      </div>
    </div>
  );
}
