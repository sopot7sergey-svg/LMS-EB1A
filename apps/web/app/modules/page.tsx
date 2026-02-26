'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { CheckCircle, PlayCircle } from 'lucide-react';

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: { id: string; title: string; order: number }[];
  _count: { lessons: number };
}

interface ModuleProgress {
  moduleId: string;
  completedLessons: number;
  totalLessons: number;
  percentage: number;
}

export default function ModulesPage() {
  const { token } = useAuthStore();
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Record<string, ModuleProgress>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        const [modulesData, progressData] = await Promise.all([
          api.modules.list(token),
          api.progress.modules(token),
        ]);

        setModules(modulesData);

        const progressMap: Record<string, ModuleProgress> = {};
        progressData.forEach((p: any) => {
          progressMap[p.moduleId] = p;
        });
        setProgress(progressMap);
      } catch (error) {
        console.error('Failed to fetch modules:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const getModuleStatus = (moduleId: string) => {
    const moduleProgress = progress[moduleId];
    if (moduleProgress?.percentage === 100) return 'completed';
    if (moduleProgress && moduleProgress.completedLessons > 0) return 'in_progress';
    return 'not_started';
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Course Modules</h1>
        <p className="mt-2 text-foreground-secondary">
          Complete each module to build your EB-1A petition package.
        </p>
      </div>

      <div className="space-y-6">
        {modules.map((module) => {
          const status = getModuleStatus(module.id);
          const moduleProgress = progress[module.id];
          const pct = moduleProgress?.percentage ?? 0;
          const completed = moduleProgress?.completedLessons ?? 0;
          const total = module._count?.lessons ?? module.lessons?.length ?? 0;

          return (
            <Link key={module.id} href={`/modules/${module.id}`} className="block group">
              <Card hover>
                <div className="flex items-start gap-6">
                  {/* Status icon */}
                  <div
                    className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
                      status === 'completed'
                        ? 'bg-success/10 text-success'
                        : status === 'in_progress'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-background-tertiary text-foreground-muted group-hover:bg-primary/10 group-hover:text-primary'
                    }`}
                  >
                    {status === 'completed' ? (
                      <CheckCircle className="h-7 w-7" />
                    ) : (
                      <PlayCircle className="h-7 w-7" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <CardHeader className="mb-0 p-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground-muted">
                          Module {module.order}
                        </span>
                        {status === 'completed' && (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                            Completed · 100%
                          </span>
                        )}
                        {status === 'in_progress' && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            In Progress · {pct}%
                          </span>
                        )}
                        {status === 'not_started' && (
                          <span className="rounded-full bg-background-tertiary px-2 py-0.5 text-xs font-medium text-foreground-muted">
                            Not started · 0%
                          </span>
                        )}
                      </div>
                      <CardTitle className="mt-1">{module.title}</CardTitle>
                      <CardDescription className="mt-1">{module.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="mt-4 p-0">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-foreground-secondary">{total} lessons</span>
                        <span className="font-medium tabular-nums">
                          {completed}/{total} completed
                        </span>
                      </div>
                      <ProgressBar value={pct} size="sm" />

                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        {status === 'completed' ? 'Review Module' : 'Open Module'}
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </CardContent>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}

        {modules.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-foreground-secondary">
                No modules available yet. Check back soon!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
