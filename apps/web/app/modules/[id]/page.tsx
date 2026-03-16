'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import {
  ArrowLeft,
  CheckCircle,
  PlayCircle,
  Circle,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { getValidEmbedUrl } from '@/lib/video-embed';

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  order: number;
  videoUrl: string | null;
  videoEmbed?: string | null;
  completed: boolean;
  completedAt: string | null;
}

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: { id: string; title: string; description: string | null; order: number; videoUrl: string | null; videoEmbed?: string | null }[];
}

function getLessonDisplayLabel(moduleOrder: number, lessonOrder: number): string {
  if (moduleOrder !== 2) {
    return `${moduleOrder}.${lessonOrder}`;
  }

  if (lessonOrder <= 4) {
    return `2.0.${lessonOrder}`;
  }

  if (lessonOrder <= 34) {
    const criterionIndex = Math.floor((lessonOrder - 5) / 3) + 1;
    const criterionLessonIndex = ((lessonOrder - 5) % 3) + 1;
    return `2.${criterionIndex}.${criterionLessonIndex}`;
  }

  return `2.C.${lessonOrder - 34}`;
}

export default function ModuleDetailPage() {
  const params = useParams();
  const { token } = useAuthStore();

  const [module, setModule] = useState<Module | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const moduleId = params.id as string;

  // Merge module lessons with completion data
  const buildLessons = useCallback(
    (
      rawLessons: { id: string; title: string; description: string | null; order: number; videoUrl: string | null; videoEmbed?: string | null }[],
      progressData: { id: string; completed: boolean; completedAt: string | null }[]
    ): Lesson[] => {
      const completionMap = new Map(progressData.map((p) => [p.id, p]));
      return rawLessons.map((l) => ({
        ...l,
        completed: completionMap.get(l.id)?.completed ?? false,
        completedAt: completionMap.get(l.id)?.completedAt ?? null,
      }));
    },
    []
  );

  useEffect(() => {
    if (!token || !moduleId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      setModuleError(null);

      // 1. Fetch module (required — show error only if this fails)
      let moduleData: Module | null = null;
      try {
        moduleData = await api.modules.get(moduleId, token);
      } catch (err: any) {
        if (!cancelled) {
          setModuleError(err?.message ?? 'Module not found');
          setIsLoading(false);
        }
        return;
      }

      // 2. Fetch lesson progress (optional — fall back to all-incomplete)
      let progressData: { id: string; completed: boolean; completedAt: string | null }[] = [];
      try {
        progressData = await api.progress.lessonsForModule(moduleId, token);
      } catch {
        // Non-fatal: no progress yet
      }

      if (!cancelled) {
        setModule(moduleData);
        if (moduleData) {
          setLessons(buildLessons(moduleData.lessons, progressData));
        }
        setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [token, moduleId, buildLessons]);

  const handleCompleteLesson = async (lessonId: string) => {
    if (!token || completingId) return;
    setCompletingId(lessonId);
    try {
      await api.lessons.complete(lessonId, token);
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lessonId ? { ...l, completed: true, completedAt: new Date().toISOString() } : l
        )
      );
    } catch (err) {
      console.error('Failed to complete lesson:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const handleUncompleteLesson = async (lessonId: string) => {
    if (!token || completingId) return;
    setCompletingId(lessonId);
    try {
      await api.lessons.uncomplete(lessonId, token);
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lessonId ? { ...l, completed: false, completedAt: null } : l
        )
      );
    } catch (err) {
      console.error('Failed to uncomplete lesson:', err);
    } finally {
      setCompletingId(null);
    }
  };

  // ── Derived stats ────────────────────────────────────────────────────────────
  const completedCount = lessons.filter((l) => l.completed).length;
  const totalCount = lessons.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (moduleError || !module) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BookOpen className="mb-4 h-12 w-12 text-foreground-muted" />
          <h2 className="text-xl font-semibold">Module not found</h2>
          <p className="mt-2 text-sm text-foreground-secondary">{moduleError}</p>
          <Link href="/modules" className="mt-6">
            <Button variant="secondary">Back to modules</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  // ── Content ──────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/modules"
          className="mb-5 inline-flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to modules
        </Link>

        <div className="flex flex-col gap-6 rounded-xl border border-border bg-background-card p-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Module {module.order}
            </p>
            <h1 className="mt-1 text-2xl font-bold">{module.title}</h1>
            {module.description && (
              <p className="mt-2 text-sm text-foreground-secondary">{module.description}</p>
            )}
          </div>

          {/* Module completion ring + bar */}
          <div className="flex w-full flex-shrink-0 flex-col items-center gap-2 sm:w-auto sm:min-w-[180px] sm:items-end">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{percentage}%</span>
              <span className="text-sm text-foreground-secondary">complete</span>
            </div>
            <div className="h-2 w-full rounded-full bg-background-tertiary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="text-xs text-foreground-muted">
              {completedCount} / {totalCount} lessons
            </p>
          </div>
        </div>
      </div>

      {/* Lessons list */}
      <div className="space-y-3">
        {lessons.map((lesson, index) => {
          const isCompleting = completingId === lesson.id;
          const lessonLabel = getLessonDisplayLabel(module.order, lesson.order);

          return (
            <div
              key={lesson.id}
              className={`group relative flex flex-col gap-4 rounded-xl border p-5 transition-all duration-200 sm:flex-row sm:items-start ${
                lesson.completed
                  ? 'border-success/30 bg-success/5'
                  : 'border-border bg-background-card hover:border-border-hover'
              }`}
            >
              {/* Progress dot / status icon */}
              <div
                className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  lesson.completed
                    ? 'border-success bg-success/10 text-success'
                    : 'border-border-hover bg-background-tertiary text-foreground-muted'
                }`}
              >
                {lesson.completed ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>

              {/* Title + description */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-foreground-muted">Lesson {lessonLabel}</span>
                  {lesson.completed && (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                      Completed · 100%
                    </span>
                  )}
                  {!lesson.completed && (
                    <span className="rounded-full bg-background-tertiary px-2 py-0.5 text-xs font-medium text-foreground-muted">
                      0%
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-medium text-foreground leading-snug">{lesson.title}</p>
                {lesson.description && (
                  <p className="mt-1 text-sm text-foreground-secondary line-clamp-2">
                    {lesson.description}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
                {getValidEmbedUrl(lesson.videoUrl, lesson.videoEmbed) && (
                  <Link href={`/modules/${moduleId}/lessons/${lesson.id}`}>
                    <Button variant="secondary" size="sm" className="min-h-[44px] gap-1.5">
                      <PlayCircle className="h-3.5 w-3.5" />
                      Watch
                    </Button>
                  </Link>
                )}

                {!lesson.completed ? (
                  <Button
                    size="sm"
                    onClick={() => handleCompleteLesson(lesson.id)}
                    disabled={isCompleting}
                    className="min-h-[44px] gap-1.5"
                  >
                    {isCompleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    Mark Complete
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUncompleteLesson(lesson.id)}
                    disabled={isCompleting}
                    className="min-h-[44px] gap-1.5 text-foreground-muted hover:text-foreground"
                  >
                    {isCompleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                    Undo
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Module complete banner */}
      {percentage === 100 && totalCount > 0 && (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-success/40 bg-success/5 p-4 text-center sm:p-6 lg:p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <CheckCircle className="h-7 w-7 text-success" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Module Completed!</h3>
            <p className="mt-1 text-sm text-foreground-secondary">
              You&apos;ve finished all {totalCount} lessons in Module {module.order}.
            </p>
          </div>
          <Link href="/modules">
            <Button>Continue to Next Module →</Button>
          </Link>
        </div>
      )}
    </DashboardLayout>
  );
}
