'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { token, isAuthenticated, isAdmin, setAuth } = useAuthStore();
  const [progress, setProgress] = useState<{ completed: number; total: number } | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [needsRedirect, setNeedsRedirect] = useState(false);

  // Wait for client mount + brief delay for Zustand persist rehydration.
  useEffect(() => {
    const t = setTimeout(() => setAuthReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (!isAuthenticated()) {
      setNeedsRedirect(true);
      router.push('/login');
      return;
    }

    if (token) {
      if (!isAdmin()) {
        api.auth.me(token).then((user) => {
          setAuth(user, token);
        }).catch(console.error);
        api.progress.overall(token).then((data) => {
          setProgress({
            completed: data.completedLessons,
            total: data.totalLessons,
          });
        }).catch(console.error);
      }
    }

    setIsLoading(false);
  }, [authReady, token, isAuthenticated, isAdmin, setAuth, router]);

  // Fallback: exit loading after 2.5s to avoid infinite loading (e.g. API down)
  useEffect(() => {
    if (!authReady) return;
    const t = setTimeout(() => setIsLoading(false), 2500);
    return () => clearTimeout(t);
  }, [authReady]);

  if (needsRedirect) {
    return (
      <div
        className="flex h-screen items-center justify-center bg-background"
        style={{ backgroundColor: '#0a0a0f', color: '#a1a1aa' }}
      >
        Redirecting to login...
      </div>
    );
  }

  if (!authReady || isLoading) {
    return (
      <div
        className="flex h-screen items-center justify-center bg-background"
        style={{ backgroundColor: '#0a0a0f', color: '#ffffff' }}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          style={{ borderColor: '#635BFF', borderTopColor: 'transparent' }}
        />
        <span className="ml-3 text-foreground-secondary" style={{ color: '#a1a1aa' }}>Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" style={{ backgroundColor: '#0a0a0f' }}>
      <Sidebar progress={progress} />
      <main className="ml-64 min-h-screen p-8" style={{ color: '#ffffff' }}>{children}</main>
    </div>
  );
}
