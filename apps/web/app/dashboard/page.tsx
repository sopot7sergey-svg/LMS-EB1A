'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useAuthStore, useCaseStore } from '@/lib/store';
import { api } from '@/lib/api';
import { BookOpen, FileText, MessageSquare, ArrowRight } from 'lucide-react';

interface ModuleProgressData {
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  totalLessons: number;
  completedLessons: number;
  percentage: number;
}

export default function DashboardPage() {
  const { token, user } = useAuthStore();
  const { currentCaseId, setCurrentCase } = useCaseStore();
  const [moduleProgress, setModuleProgress] = useState<ModuleProgressData[]>([]);
  const [caseData, setCaseData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [progressData, casesData] = await Promise.all([
          api.progress.modules(token),
          api.cases.list(token),
        ]);

        setModuleProgress(progressData);

        if (casesData.length > 0) {
          const latestCase = casesData[0];
          setCaseData(latestCase);
          setCurrentCase(latestCase.id);
        } else {
          setCaseData(null);
          if (currentCaseId) {
            setCurrentCase(null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token, currentCaseId, setCurrentCase]);

  const handleCreateCase = async () => {
    if (!token) return;

    try {
      const newCase = await api.cases.create(token);
      setCaseData(newCase);
      setCurrentCase(newCase.id);
    } catch (error) {
      console.error('Failed to create case:', error);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center" style={{ color: '#a1a1aa' }}>
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
            style={{ borderColor: '#635BFF', borderTopColor: 'transparent' }}
          />
          <span className="ml-3">Loading...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Welcome back, {user?.name}</h1>
        <p className="mt-2 text-foreground-secondary">
          Continue building your EB-1A petition package.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Course Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {moduleProgress.map((module) => (
                <Link
                  key={module.moduleId}
                  href={`/modules/${module.moduleId}`}
                  className="block rounded-lg border border-border p-4 transition-colors hover:border-border-hover hover:bg-background-secondary"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">
                      Module {module.moduleOrder}: {module.moduleTitle}
                    </span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-foreground-secondary">
                        {module.completedLessons}/{module.totalLessons}
                      </span>
                      <span
                        className={`font-semibold tabular-nums ${
                          module.percentage === 100
                            ? 'text-success'
                            : module.percentage > 0
                            ? 'text-primary'
                            : 'text-foreground-muted'
                        }`}
                      >
                        {module.percentage}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={module.percentage} size="sm" />
                </Link>
              ))}

              {moduleProgress.length === 0 && (
                <p className="text-center text-foreground-secondary">
                  No modules available yet. Check back soon!
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Case</CardTitle>
            </CardHeader>
            <CardContent>
              {caseData ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-background-secondary p-3">
                    <p className="text-sm text-foreground-secondary">Status</p>
                    <p className="font-medium capitalize">{caseData.status.replace('_', ' ')}</p>
                  </div>
                  <div className="rounded-lg bg-background-secondary p-3">
                    <p className="text-sm text-foreground-secondary">Criteria Selected</p>
                    <p className="font-medium">
                      {caseData.criteriaSelected?.length || 0} criteria
                    </p>
                  </div>
                  <Link href={`/case/${caseData.id}`}>
                    <Button className="w-full">
                      View Case
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center">
                  <p className="mb-4 text-foreground-secondary">
                    Start your EB-1A journey by creating a case.
                  </p>
                  <Button onClick={handleCreateCase}>Create Case</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link
                  href="/modules"
                  className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-background-secondary"
                >
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span>Continue Course</span>
                </Link>
                <Link
                  href="/chat"
                  className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-background-secondary"
                >
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <span>Chat with Admin</span>
                </Link>
                {caseData && (
                  <Link
                    href={`/case/${caseData.id}/documents`}
                    className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-background-secondary"
                  >
                    <FileText className="h-5 w-5 text-primary" />
                    <span>Upload Documents</span>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
