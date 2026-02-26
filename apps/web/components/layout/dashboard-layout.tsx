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
  const { token, isAuthenticated, isAdmin } = useAuthStore();
  const [progress, setProgress] = useState<{ completed: number; total: number } | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    if (!isAdmin() && token) {
      api.progress.overall(token).then((data) => {
        setProgress({
          completed: data.completedLessons,
          total: data.totalLessons,
        });
      }).catch(console.error);
    }

    setIsLoading(false);
  }, [token, isAuthenticated, isAdmin, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar progress={progress} />
      <main className="ml-64 min-h-screen p-8">{children}</main>
    </div>
  );
}
