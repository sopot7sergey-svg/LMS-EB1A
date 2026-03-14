'use client';

export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div
      className="flex min-h-[12rem] items-center justify-center gap-3"
      style={{ color: 'var(--foreground-secondary, #a1a1aa)' }}
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        style={{ borderColor: '#635BFF', borderTopColor: 'transparent' }}
      />
      <span>{message}</span>
    </div>
  );
}
