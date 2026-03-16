'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Menu } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { token, isAuthenticated, isAdmin, setAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Lock body scroll when mobile drawer is open (below lg only)
  useEffect(() => {
    if (!sidebarOpen) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  // Close drawer when viewport becomes lg or larger (prevents stale overlay/state after resize)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = () => {
      if (mq.matches) setSidebarOpen(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
    <div className="min-h-screen overflow-x-hidden bg-background" style={{ backgroundColor: '#0a0a0f' }}>
      <Sidebar progress={progress} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background-secondary px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="-ml-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-foreground-secondary hover:bg-background-tertiary hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="font-semibold">Aipas</span>
      </header>
      <main className="ml-0 min-h-screen p-4 sm:p-6 lg:ml-64 lg:p-8" style={{ color: '#ffffff' }}>{children}</main>
    </div>
  );
}
