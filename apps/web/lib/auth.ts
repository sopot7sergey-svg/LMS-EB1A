'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from './store';

/**
 * Returns auth state only after client mount.
 * Use this to avoid hydration mismatch with Zustand persist.
 * isReady becomes true after mount + brief delay for persist rehydration.
 */
export function useAuthReady() {
  const { token, user, isAuthenticated, isAdmin } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Brief delay to allow Zustand persist to rehydrate from localStorage.
    // Without this, we may redirect logged-in users before rehydration completes.
    const t = setTimeout(() => setIsReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  return {
    isReady,
    token,
    user,
    isAuthenticated: () => !!token,
    isAdmin: () => user?.role === 'admin',
  };
}
