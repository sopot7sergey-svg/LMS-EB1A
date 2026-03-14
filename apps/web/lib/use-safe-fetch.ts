'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseSafeFetchOptions {
  /** If false, skip the fetch (e.g. when token is missing). Always calls setLoading(false). */
  enabled?: boolean;
}

/**
 * Shared hook for protected-page data fetching.
 * Handles: loading state, error state, token check (enabled=false), retry.
 * Use with ProtectedPageShell for consistent loading/error UI.
 */
export function useSafeFetch<T>(
  fetchFn: () => Promise<T>,
  deps: React.DependencyList,
  options: UseSafeFetchOptions = {}
) {
  const { enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setError(msg);
      console.error('useSafeFetch error:', err);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, isLoading, error, retry: execute };
}
