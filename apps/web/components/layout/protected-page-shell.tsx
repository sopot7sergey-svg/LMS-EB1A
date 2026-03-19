'use client';

import { DashboardLayout } from './dashboard-layout';
import { PageLoading } from '@/components/ui/page-loading';
import { PageError } from '@/components/ui/page-error';

interface ProtectedPageShellProps {
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  loadingMessage?: string;
  errorTitle?: string;
}

/**
 * Shared shell for protected pages. Renders DashboardLayout with consistent
 * loading and error states. Use for pages that require auth and use DashboardLayout.
 */
export function ProtectedPageShell({
  children,
  isLoading = false,
  error = null,
  onRetry,
  loadingMessage = 'Загрузка...',
  errorTitle = 'Что-то пошло не так',
}: ProtectedPageShellProps) {
  if (isLoading && !error) {
    return (
      <DashboardLayout>
        <PageLoading message={loadingMessage} />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <PageError
          title={errorTitle}
          message={error}
          onRetry={onRetry}
          backHref="/dashboard"
        />
      </DashboardLayout>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

/**
 * Content-only shell for pages inside a layout (e.g. account/*).
 * Use when the parent layout already provides DashboardLayout.
 */
export function ContentShell({
  children,
  isLoading = false,
  error = null,
  onRetry,
  loadingMessage = 'Загрузка...',
  errorTitle = 'Что-то пошло не так',
}: ProtectedPageShellProps) {
  if (isLoading && !error) {
    return <PageLoading message={loadingMessage} />;
  }
  if (error) {
    return (
      <PageError
        title={errorTitle}
        message={error}
        onRetry={onRetry}
        backHref="/account"
      />
    );
  }
  return <>{children}</>;
}
