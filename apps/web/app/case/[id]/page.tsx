'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import {
  ToolCards,
  ChecklistAccordion,
  EERModal,
  RightPanel,
  CreatorModal,
  FormsFillerModal,
  AdvisorChatModal,
} from '@/components/case-workspace';
import type { ToolId } from '@/components/case-workspace';
import type { CaseLifecycleStatus, CriterionEvidenceStatus, EERReportItem } from '@lms-eb1a/shared';
import { ClipboardCheck, Pencil, Check } from 'lucide-react';

const LIFECYCLE_STATUSES: CaseLifecycleStatus[] = [
  'draft',
  'building',
  'review_ready',
  'in_review',
  'iterating',
  'filing_ready',
  'filed',
];

interface CaseData {
  id: string;
  status: string;
  caseAxisStatement: string | null;
  proposedEndeavor: string | null;
  keywords: string[];
  criteriaSelected: string[];
  workspace: any;
  documents: any[];
  letters: any[];
  evidencePacks: any[];
  eers: any[];
}

export default function CaseDetailPage() {
  const params = useParams();
  const { token } = useAuthStore();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [caseName, setCaseName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [lifecycleStatus, setLifecycleStatus] = useState<CaseLifecycleStatus>('draft');
  const [stage, setStage] = useState('M0');
  const [criteriaStatuses, setCriteriaStatuses] = useState<Record<string, CriterionEvidenceStatus>>({});
  const [eerModalOpen, setEERModalOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [eerItems, setEerItems] = useState<EERReportItem[]>([]);
  const [isGeneratingEER, setIsGeneratingEER] = useState(false);

  const caseId = params.id as string;

  const fetchCase = useCallback(async () => {
    if (!token || !caseId) return;
    try {
      const data = await api.cases.get(caseId, token);
      setCaseData(data);
      setCaseName(data.caseAxisStatement || 'Untitled Case');
      setLifecycleStatus(mapApiStatusToLifecycle(data.status));
      if (data.eers?.length > 0) {
        const latest = data.eers[0];
        const items = [
          ...(latest.criterionItems || []).map((i: any) => ({
            id: i.id,
            severity: i.priority || i.severity || 'recommended',
            criterionId: i.criterionId,
            issue: i.ask || i.issue,
            whyItMatters: i.whyItMatters || '',
            requestedFix: i.requestedFix || i.ask || '',
            suggestedTemplate: i.suggestedTemplate,
            status: (i.status || 'open') as 'open' | 'resolved',
            resolutionNote: i.resolutionNote,
            linkedEvidenceIds: i.linkedEvidenceIds,
            deepLink: i.deepLink,
          })),
          ...(latest.finalMeritsItems || []).map((i: any) => ({
            id: i.id,
            severity: i.priority || i.severity || 'recommended',
            criterionId: undefined,
            issue: i.ask || i.issue,
            whyItMatters: '',
            requestedFix: i.ask || '',
            suggestedTemplate: undefined,
            status: 'open' as const,
            resolutionNote: undefined,
            linkedEvidenceIds: undefined,
            deepLink: undefined,
          })),
          ...(latest.optionalPackagingItems || []).map((i: any) => ({
            id: i.id,
            severity: 'optional' as const,
            criterionId: undefined,
            issue: i.ask || i.issue,
            whyItMatters: '',
            requestedFix: i.ask || '',
            suggestedTemplate: undefined,
            status: 'open' as const,
            resolutionNote: undefined,
            linkedEvidenceIds: undefined,
            deepLink: undefined,
          })),
        ];
        setEerItems(items);
      }
    } catch (error) {
      console.error('Failed to fetch case:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, caseId]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  const mapApiStatusToLifecycle = (apiStatus: string): CaseLifecycleStatus => {
    const m: Record<string, CaseLifecycleStatus> = {
      draft: 'draft',
      in_progress: 'building',
      submitted: 'filed',
      completed: 'filed',
    };
    return m[apiStatus] || 'draft';
  };

  const handleUpdateCaseName = async () => {
    if (!token || !caseId || !caseName.trim()) return;
    setIsEditingName(false);
    try {
      await api.cases.update(caseId, { caseAxisStatement: caseName }, token);
      setCaseData((prev) => (prev ? { ...prev, caseAxisStatement: caseName } : null));
    } catch (error) {
      console.error('Failed to update case name:', error);
    }
  };

  const checklistCompletionPercent = (() => {
    const totalSlots = 50;
    const filled = (caseData?.documents?.length || 0) + (caseData?.letters?.length || 0) * 2;
    return Math.min(100, Math.round((filled / totalSlots) * 100));
  })();

  const evidenceCoverageCount = Object.values(criteriaStatuses).filter(
    (s) => s === 'supported' || s === 'strongly_supported'
  ).length;

  const nextActions = [
    'Complete Case Profile Data (Section 0)',
    'Add Case Axis Statement',
    'Upload evidence for at least 3 criteria',
  ];

  const openTasks = eerItems.filter((i) => i.status === 'open').map((i) => i.issue);

  const handleToolClick = (toolId: ToolId) => {
    if (toolId === 'officer-review') {
      setEERModalOpen(true);
    } else {
      setActiveTool(toolId);
    }
  };

  const handleGenerateEER = async (scope: {
    whole: boolean;
    criteria?: string[];
    documentTypes?: string[];
  }) => {
    if (!token || !caseData) return;
    setIsGeneratingEER(true);
    try {
      const newEer = await api.eer.generate(
        caseId,
        scope.whole ? (caseData.criteriaSelected || []) : (scope.criteria || []),
        token
      );
      const items = [
        ...(newEer.criterionItems || []).map((i: any) => ({
          id: i.id,
          severity: i.priority || i.severity || 'recommended',
          criterionId: i.criterionId,
          issue: i.ask || i.issue,
          whyItMatters: i.whyItMatters || '',
          requestedFix: i.requestedFix || i.ask || '',
          suggestedTemplate: i.suggestedTemplate,
          status: (i.status || 'open') as 'open' | 'resolved',
          resolutionNote: i.resolutionNote,
          linkedEvidenceIds: i.linkedEvidenceIds,
          deepLink: i.deepLink,
        })),
        ...(newEer.finalMeritsItems || []).map((i: any) => ({
          id: i.id,
          severity: i.priority || i.severity || 'recommended',
          criterionId: undefined,
          issue: i.ask || i.issue,
          whyItMatters: '',
          requestedFix: i.ask || '',
          suggestedTemplate: undefined,
          status: 'open' as const,
          resolutionNote: undefined,
          linkedEvidenceIds: undefined,
          deepLink: undefined,
        })),
        ...(newEer.optionalPackagingItems || []).map((i: any) => ({
          id: i.id,
          severity: 'optional' as const,
          criterionId: undefined,
          issue: i.ask || i.issue,
          whyItMatters: '',
          requestedFix: i.ask || '',
          suggestedTemplate: undefined,
          status: 'open' as const,
          resolutionNote: undefined,
          linkedEvidenceIds: undefined,
          deepLink: undefined,
        })),
      ];
      setEerItems(items);
      fetchCase();
    } catch (error) {
      console.error('Failed to generate EER:', error);
    } finally {
      setIsGeneratingEER(false);
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

  if (!caseData) {
    return (
      <DashboardLayout>
        <div className="text-center">
          <p className="text-foreground-secondary">Case not found.</p>
          <Link href="/case" className="mt-4 inline-block text-primary hover:underline">
            Back to cases
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link
          href="/case"
          className="mb-4 inline-flex items-center text-sm text-foreground-secondary hover:text-foreground"
        >
          ← Back to cases
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-center gap-4 border-b border-border pb-6">
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={caseName}
                  onChange={(e) => setCaseName(e.target.value)}
                  onBlur={handleUpdateCaseName}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateCaseName()}
                  className="input max-w-md"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleUpdateCaseName}
                  className="rounded p-1.5 text-primary hover:bg-primary/10"
                >
                  <Check className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="flex items-center gap-2 text-2xl font-bold hover:text-primary transition-colors group"
              >
                {caseName || 'Untitled Case'}
                <Pencil className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>

          <span
            className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${
              lifecycleStatus === 'filed'
                ? 'bg-success/10 text-success'
                : lifecycleStatus === 'building' || lifecycleStatus === 'iterating'
                ? 'bg-primary/10 text-primary'
                : 'bg-background-tertiary text-foreground-secondary'
            }`}
          >
            {lifecycleStatus.replace('_', ' ')}
          </span>

          <div className="flex items-center gap-6">
            <div className="w-32">
              <p className="text-xs text-foreground-muted mb-1">Checklist</p>
              <ProgressBar value={checklistCompletionPercent} size="sm" />
              <p className="text-xs text-foreground-secondary mt-0.5">
                {checklistCompletionPercent}%
              </p>
            </div>
            <div className="w-32">
              <p className="text-xs text-foreground-muted mb-1">Evidence Coverage</p>
              <p className="text-lg font-semibold">
                {evidenceCoverageCount}/10
              </p>
            </div>
            <div className="w-24">
              <p className="text-xs text-foreground-muted mb-1">Package Readability</p>
              <p className="text-sm text-foreground-muted">—</p>
            </div>
          </div>

          <Button onClick={() => setEERModalOpen(true)}>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Submit for Review
          </Button>
        </div>

        {/* Tool Cards */}
        <div className="mt-6">
          <ToolCards onToolClick={handleToolClick} />
        </div>

        {/* Main content grid */}
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Submission Checklist</h2>
            <ChecklistAccordion
              caseId={caseId}
              criteriaStatuses={criteriaStatuses}
              onCriteriaStatusChange={(criterionId, status) =>
                setCriteriaStatuses((prev) => ({ ...prev, [criterionId]: status }))
              }
              onAddEvidence={(sectionId, criterionId, slotType) => {
                setActiveTool('creator');
              }}
              onGenerateNarrative={() => setActiveTool('creator')}
            />
          </div>

          <div>
            <RightPanel
              stage={stage}
              onStageChange={setStage}
              nextActions={nextActions}
              openTasks={openTasks}
              onGenerateNarrative={() => setActiveTool('creator')}
              onAskAdvisor={() => setActiveTool('advisor-chat')}
              onSubmitForReview={() => setEERModalOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <EERModal
        open={eerModalOpen}
        onClose={() => setEERModalOpen(false)}
        caseId={caseId}
        eerReports={eerItems}
        onGenerate={handleGenerateEER}
        onMarkResolved={(itemId) => {
          setEerItems((prev) =>
            prev.map((i) => (i.id === itemId ? { ...i, status: 'resolved' as const } : i))
          );
        }}
        onCreateDraft={() => setActiveTool('creator')}
        onDeepLink={() => {}}
        isGenerating={isGeneratingEER}
      />

      <CreatorModal
        toolId={activeTool}
        onClose={() => setActiveTool(null)}
        caseId={caseId}
      />
      <FormsFillerModal
        toolId={activeTool}
        onClose={() => setActiveTool(null)}
        caseId={caseId}
      />
      <AdvisorChatModal
        toolId={activeTool}
        onClose={() => setActiveTool(null)}
        caseId={caseId}
      />
    </DashboardLayout>
  );
}
