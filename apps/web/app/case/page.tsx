'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore, useCaseStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Plus, FileText, ArrowRight } from 'lucide-react';

interface Case {
  id: string;
  status: string;
  caseAxisStatement: string | null;
  proposedEndeavor: string | null;
  criteriaSelected: string[];
  createdAt: string;
}

export default function CasesPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { setCurrentCase } = useCaseStore();
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchCases = async () => {
      try {
        const data = await api.cases.list(token);
        setCases(data);
      } catch (error) {
        console.error('Failed to fetch cases:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCases();
  }, [token]);

  const handleCreateCase = async () => {
    if (!token) return;

    setIsCreating(true);
    try {
      const newCase = await api.cases.create(token);
      setCurrentCase(newCase.id);
      router.push(`/case/${newCase.id}`);
    } catch (error) {
      console.error('Failed to create case:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectCase = (caseId: string) => {
    setCurrentCase(caseId);
    router.push(`/case/${caseId}`);
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Cases</h1>
          <p className="mt-2 text-foreground-secondary">
            Manage your EB-1A petition cases.
          </p>
        </div>
        <Button onClick={handleCreateCase} isLoading={isCreating}>
          <Plus className="mr-2 h-4 w-4" />
          New Case
        </Button>
      </div>

      {cases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-foreground-muted" />
            <h3 className="text-lg font-semibold">No cases yet</h3>
            <p className="mt-2 text-foreground-secondary">
              Create your first case to start building your EB-1A petition.
            </p>
            <Button className="mt-4" onClick={handleCreateCase} isLoading={isCreating}>
              Create Case
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((caseItem) => (
            <Card key={caseItem.id} hover>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      caseItem.status === 'completed'
                        ? 'bg-success/10 text-success'
                        : caseItem.status === 'in_progress'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-background-tertiary text-foreground-secondary'
                    }`}
                  >
                    {caseItem.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {new Date(caseItem.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <CardTitle className="mt-2">
                  {caseItem.caseAxisStatement
                    ? caseItem.caseAxisStatement.slice(0, 50) + '...'
                    : 'Untitled Case'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground-secondary">Criteria</span>
                    <span>{caseItem.criteriaSelected?.length || 0} selected</span>
                  </div>
                  {caseItem.proposedEndeavor && (
                    <p className="text-sm text-foreground-secondary line-clamp-2">
                      {caseItem.proposedEndeavor}
                    </p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleSelectCase(caseItem.id)}
                >
                  View Case
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
