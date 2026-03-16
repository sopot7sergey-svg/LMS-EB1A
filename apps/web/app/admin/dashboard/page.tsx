'use client';

import { useEffect, useState } from 'react';
import { ProtectedPageShell } from '@/components/layout/protected-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Users, BookOpen, FileText, Activity } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalCases: number;
  totalLessons: number;
}

interface RecentActivity {
  id: string;
  user: { name: string; email: string };
  lesson: { title: string };
  completedAt: string;
}

export default function AdminDashboardPage() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = () => {
    if (!token) return;
    setFetchError(null);
    setIsLoading(true);
    api.admin.dashboard(token)
      .then((data) => {
        setStats(data.stats);
        setRecentActivity(data.recentActivity);
      })
      .catch((err) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load');
        console.error('Failed to fetch dashboard:', err);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetchData();
  }, [token]);

  return (
    <ProtectedPageShell
      isLoading={isLoading && !fetchError}
      error={fetchError}
      onRetry={fetchData}
      loadingMessage="Loading dashboard..."
      errorTitle="Failed to load dashboard"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-foreground-secondary">
          Overview of your LMS platform.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-foreground-secondary">Total Students</p>
                <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <FileText className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-foreground-secondary">Total Cases</p>
                <p className="text-2xl font-bold">{stats?.totalCases || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <BookOpen className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-foreground-secondary">Total Lessons</p>
                <p className="text-2xl font-bold">{stats?.totalLessons || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-center text-foreground-secondary py-8">
              No recent activity.
            </p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {activity.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{activity.user.name}</p>
                    <p className="text-sm text-foreground-secondary">
                      Completed: {activity.lesson.title}
                    </p>
                  </div>
                  <span className="text-sm text-foreground-muted">
                    {new Date(activity.completedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </ProtectedPageShell>
  );
}
