'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  videoEmbed: string | null;
  order: number;
  completed: boolean;
  completedAt: string | null;
  module: { id: string; title: string };
}

/** Convert YouTube/Vimeo watch URLs to embed URLs for iframe */
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    // YouTube: watch?v=xxx or youtu.be/xxx
    if (u.hostname.includes('youtube.com') && u.searchParams.has('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    // Vimeo: vimeo.com/123456
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return `https://player.vimeo.com/video/${id}`;
    }
    // Already embed or other URL
    return url;
  } catch {
    return url;
  }
}

export default function LessonPage() {
  const params = useParams();
  const { token } = useAuthStore();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const moduleId = params.id as string;
  const lessonId = params.lessonId as string;

  useEffect(() => {
    if (!token || !lessonId) return;

    const fetchLesson = async () => {
      try {
        const data = await api.lessons.get(lessonId, token);
        setLesson(data);
      } catch (err: any) {
        setError(err?.message ?? 'Lesson not found');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLesson();
  }, [token, lessonId]);

  const handleComplete = async () => {
    if (!token || !lesson || isCompleting) return;
    setIsCompleting(true);
    try {
      await api.lessons.complete(lessonId, token);
      setLesson((prev) =>
        prev ? { ...prev, completed: true, completedAt: new Date().toISOString() } : null
      );
    } catch (err) {
      console.error('Failed to complete:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !lesson) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h2 className="text-xl font-semibold">Lesson not found</h2>
          <p className="mt-2 text-sm text-foreground-secondary">{error}</p>
          <Link href={`/modules/${moduleId}`} className="mt-6">
            <Button variant="secondary">Back to module</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link
          href={`/modules/${moduleId}`}
          className="inline-flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {lesson.module.title}
        </Link>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-background-card p-6">
          <h1 className="text-2xl font-bold">{lesson.title}</h1>
          {lesson.description && (
            <p className="mt-2 text-foreground-secondary">{lesson.description}</p>
          )}
          {lesson.completed && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-sm font-medium text-success">
              <CheckCircle className="h-4 w-4" />
              Completed
            </span>
          )}
        </div>

        {/* Video player */}
        <div className="rounded-xl border border-border bg-background-card overflow-hidden">
          {lesson.videoEmbed ? (
            <div
              className="aspect-video w-full"
              dangerouslySetInnerHTML={{ __html: lesson.videoEmbed }}
            />
          ) : lesson.videoUrl ? (
            <div className="aspect-video w-full">
              <iframe
                src={toEmbedUrl(lesson.videoUrl)}
                title={lesson.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center bg-background-tertiary text-foreground-muted">
              No video available
            </div>
          )}
        </div>

        {!lesson.completed && (
          <Button onClick={handleComplete} disabled={isCompleting}>
            {isCompleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Mark as complete
          </Button>
        )}
      </div>
    </DashboardLayout>
  );
}
