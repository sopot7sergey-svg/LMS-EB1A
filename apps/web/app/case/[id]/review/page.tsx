'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { CRITERIA } from '@lms-eb1a/shared';
import {
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';

interface EERItem {
  id: string;
  priority: 'critical' | 'recommended' | 'optional';
  category: string;
  ask: string;
  citations: { source: string; excerptId: string; section?: string }[];
  criterionId?: string;
  criterionStatus?: string;
}

interface EER {
  id: string;
  version: number;
  executiveSummary: string;
  criterionItems: EERItem[];
  finalMeritsItems: EERItem[];
  optionalPackagingItems: EERItem[];
  createdAt: string;
}

export default function ReviewPage() {
  const params = useParams();
  const { token } = useAuthStore();
  const [eers, setEers] = useState<EER[]>([]);
  const [selectedEer, setSelectedEer] = useState<EER | null>(null);
  const [caseData, setCaseData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const caseId = params.id as string;

  useEffect(() => {
    if (!token || !caseId) return;

    const fetchData = async () => {
      try {
        const [eersData, caseResponse] = await Promise.all([
          api.eer.list(caseId, token),
          api.cases.get(caseId, token),
        ]);
        setEers(eersData);
        setCaseData(caseResponse);
        if (eersData.length > 0) {
          setSelectedEer(eersData[0]);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token, caseId]);

  const handleGenerateEER = async () => {
    if (!token || !caseData) return;

    setIsGenerating(true);
    try {
      const newEer = await api.eer.generate(
        caseId,
        caseData.criteriaSelected || [],
        token
      );
      setEers((prev) => [newEer, ...prev]);
      setSelectedEer(newEer);
    } catch (error) {
      console.error('Failed to generate EER:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-error" />;
      case 'recommended':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return <Info className="h-5 w-5 text-foreground-muted" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-error/50 bg-error/5';
      case 'recommended':
        return 'border-warning/50 bg-warning/5';
      default:
        return 'border-border bg-background-secondary';
    }
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
        <Link
          href={`/case/${caseId}`}
          className="mb-4 inline-flex items-center text-sm text-foreground-secondary hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to case
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Officer-Style Review</h1>
            <p className="mt-2 text-foreground-secondary">
              Get Evidence Enhancement Requests (EER) with citations to authoritative sources.
            </p>
          </div>
          <Button onClick={handleGenerateEER} isLoading={isGenerating}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Generate New EER
          </Button>
        </div>
      </div>

      {eers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-foreground-muted" />
            <h3 className="text-lg font-semibold">No EER Reports Yet</h3>
            <p className="mt-2 text-foreground-secondary">
              Generate your first Evidence Enhancement Request to get feedback on your petition.
            </p>
            <Button className="mt-4" onClick={handleGenerateEER} isLoading={isGenerating}>
              Generate EER
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>EER Versions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {eers.map((eer) => (
                    <button
                      key={eer.id}
                      onClick={() => setSelectedEer(eer)}
                      className={`w-full rounded-lg p-3 text-left transition-colors ${
                        selectedEer?.id === eer.id
                          ? 'bg-primary/10 border border-primary'
                          : 'bg-background-secondary hover:bg-background-tertiary'
                      }`}
                    >
                      <p className="font-medium">Version {eer.version}</p>
                      <p className="text-sm text-foreground-muted">
                        {new Date(eer.createdAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {selectedEer && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Executive Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-foreground-secondary">
                      {selectedEer.executiveSummary}
                    </p>
                  </CardContent>
                </Card>

                {selectedEer.criterionItems.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Criterion-by-Criterion Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {selectedEer.criterionItems.map((item) => (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-4 ${getPriorityColor(item.priority)}`}
                          >
                            <div className="flex items-start gap-3">
                              {getPriorityIcon(item.priority)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {item.criterionId && (
                                    <span className="rounded bg-background-tertiary px-2 py-0.5 text-xs font-medium">
                                      {item.criterionId}
                                    </span>
                                  )}
                                  <span className="rounded bg-background-tertiary px-2 py-0.5 text-xs font-medium capitalize">
                                    {item.priority}
                                  </span>
                                  {item.criterionStatus && (
                                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                                      item.criterionStatus === 'met'
                                        ? 'bg-success/10 text-success'
                                        : item.criterionStatus === 'partially_met'
                                        ? 'bg-warning/10 text-warning'
                                        : 'bg-error/10 text-error'
                                    }`}>
                                      {item.criterionStatus.replace('_', ' ')}
                                    </span>
                                  )}
                                </div>
                                <p className="font-medium">{item.ask}</p>
                                {item.citations.length > 0 && (
                                  <div className="mt-2 text-sm text-foreground-muted">
                                    <span className="font-medium">Citations: </span>
                                    {item.citations.map((c, i) => (
                                      <span key={i}>
                                        {c.source}
                                        {c.section && ` (${c.section})`}
                                        {i < item.citations.length - 1 && ', '}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedEer.finalMeritsItems.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Final Merits Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {selectedEer.finalMeritsItems.map((item) => (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-4 ${getPriorityColor(item.priority)}`}
                          >
                            <div className="flex items-start gap-3">
                              {getPriorityIcon(item.priority)}
                              <div className="flex-1">
                                <span className="rounded bg-background-tertiary px-2 py-0.5 text-xs font-medium capitalize">
                                  {item.priority}
                                </span>
                                <p className="mt-2 font-medium">{item.ask}</p>
                                {item.citations.length > 0 && (
                                  <div className="mt-2 text-sm text-foreground-muted">
                                    <span className="font-medium">Citations: </span>
                                    {item.citations.map((c, i) => (
                                      <span key={i}>
                                        {c.source}
                                        {c.section && ` (${c.section})`}
                                        {i < item.citations.length - 1 && ', '}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedEer.optionalPackagingItems.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Optional Packaging Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {selectedEer.optionalPackagingItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-border bg-background-secondary p-4"
                          >
                            <div className="flex items-start gap-3">
                              <Info className="h-5 w-5 text-foreground-muted" />
                              <p>{item.ask}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 rounded-lg border border-border bg-background-secondary p-4">
        <p className="text-sm text-foreground-muted">
          <strong>Disclaimer:</strong> This review does not provide legal advice or predict
          immigration outcomes. All AI-generated content should be reviewed by a qualified
          immigration attorney.
        </p>
      </div>
    </DashboardLayout>
  );
}
