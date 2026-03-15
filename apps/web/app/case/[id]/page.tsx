'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useAuthStore, useCaseStore } from '@/lib/store';
import { api } from '@/lib/api';
import {
  ToolCards,
  ChecklistAccordion,
  EERModal,
  CompileModal,
  DocumentViewerModal,
  DocumentBuilderModal,
  DocumentTemplateViewer,
  DocumentAssistantModal,
  AdvisorChatModal,
  PacketReviewModal,
} from '@/components/case-workspace';
import type { ToolId } from '@/components/case-workspace';
import {
  DOCUMENT_ASSISTANT_BUILDER_MAP,
  type DocumentReviewResult,
  getDocumentBuilderSummary,
  type CaseLifecycleStatus,
  type CriterionEvidenceStatus,
  type EERReportItem,
} from '@aipas/shared';
import { CHECKLIST_SLOT_CONFIGS, getChecklistBuilderConfig } from '@/components/case-workspace/checklist-slots';
import { Pencil, Check, FileStack, Lock } from 'lucide-react';

const LIFECYCLE_STATUSES: CaseLifecycleStatus[] = [
  'draft',
  'building',
  'review_ready',
  'in_review',
  'iterating',
  'filing_ready',
  'filed',
];

interface CompileJobSummary {
  id: string;
  status: string;
  createdAt: string;
  artifact?: {
    id: string;
    version: number;
    optionsHash?: string | null;
    createdAt: string;
  } | null;
}

interface CaseData {
  id: string;
  status: string;
  caseAxisStatement: string | null;
  proposedEndeavor: string | null;
  keywords: string[];
  criteriaSelected: string[];
  workspace: any;
  documents: any[];
  documentBuilders: any[];
  letters: any[];
  evidencePacks: any[];
  eers: any[];
  compileJobs?: CompileJobSummary[];
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuthStore();
  const { currentCaseId, setCurrentCase } = useCaseStore();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [caseName, setCaseName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [lifecycleStatus, setLifecycleStatus] = useState<CaseLifecycleStatus>('draft');
  const [criteriaStatuses, setCriteriaStatuses] = useState<Record<string, CriterionEvidenceStatus>>({});
  const [eerModalOpen, setEERModalOpen] = useState(false);
  const [compileModalOpen, setCompileModalOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [eerItems, setEerItems] = useState<EERReportItem[]>([]);
  const [documentReviews, setDocumentReviews] = useState<Array<{
    documentId: string;
    originalName: string;
    category?: string | null;
    review: DocumentReviewResult;
    reviewDocumentId?: string | null;
    reviewDocumentName?: string | null;
  }>>([]);
  const [isGeneratingEER, setIsGeneratingEER] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<{ id: string; name: string } | null>(null);
  const [activeBuilderSlot, setActiveBuilderSlot] = useState<string | null>(null);
  const [templateSlot, setTemplateSlot] = useState<string | null>(null);
  const [focusedSlotType, setFocusedSlotType] = useState<string | null>(null);
  const [slotFocusMode, setSlotFocusMode] = useState<'open' | 'upload'>('open');
  const [packetReviewOpen, setPacketReviewOpen] = useState(false);
  const [latestCompileJobId, setLatestCompileJobId] = useState<string | null>(null);
  const [auditPacketVersion, setAuditPacketVersion] = useState<number | undefined>(undefined);
  const [savedReportJobId, setSavedReportJobId] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  const caseId = params.id as string;

  const fetchCase = useCallback(async () => {
    if (!token || !caseId) {
      setIsLoading(false);
      return;
    }
    setAccessError(null);
    try {
      const data = await api.cases.get(caseId, token);
      setCaseData(data);
      if (currentCaseId !== caseId) {
        setCurrentCase(caseId);
      }
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
      if (error instanceof Error) {
        if (error.message.includes('App access expired') || error.message.includes('Renew your plan')) {
          setAccessError(error.message);
          return;
        }
        if (error.message.includes('Case not found')) {
          if (currentCaseId === caseId) {
            setCurrentCase(null);
          }
          router.replace('/case');
          return;
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, caseId, currentCaseId, setCurrentCase, router]);

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

  const evidenceCoverageCount = Object.values(criteriaStatuses).filter(
    (s) => s === 'supported' || s === 'strongly_supported'
  ).length;

  const openTasks = eerItems.filter((i) => i.status === 'open').map((i) => i.issue);

  const handleToolClick = async (toolId: ToolId) => {
    if (toolId === 'officer-review') {
      setEERModalOpen(true);
    } else {
      setActiveTool(toolId);
    }
  };

  const handleOpenFormTemplate = (slotType: string) => {
    const config = getChecklistBuilderConfig(slotType);
    if (!config?.templateUrl) return;
    window.open(config.templateUrl, '_blank', 'noopener,noreferrer');
  };

  const focusChecklistSlot = useCallback((slotType: string, mode: 'open' | 'upload' = 'open') => {
    setFocusedSlotType(slotType);
    setSlotFocusMode(mode);
  }, []);

  const openDraftForSlot = useCallback((slotType: string) => {
    if (getChecklistBuilderConfig(slotType)) {
      setActiveBuilderSlot(slotType);
      return;
    }
    focusChecklistSlot(slotType, 'upload');
  }, [focusChecklistSlot]);

  const checklistSlots = useMemo(
    () =>
      Object.entries(CHECKLIST_SLOT_CONFIGS).flatMap(([sectionId, slots]) =>
        slots.map((slot) => ({ ...slot, sectionId }))
      ),
    []
  );

  const slotSummaries = useMemo(
    () =>
      checklistSlots.map((slot) => ({
        ...slot,
        ...getDocumentBuilderSummary(
          slot.slotType,
          (caseData?.documents || []) as Array<{ metadata?: { slotType?: string; source?: 'upload' | 'generated' | 'source_upload' } | null }>,
          (caseData?.documentBuilders || []) as Array<{ slotType: string; status: 'not_started' | 'in_progress' | 'added' | 'created' | 'completed'; progress?: number | null }>
        ),
      })),
    [caseData?.documentBuilders, caseData?.documents, checklistSlots]
  );

  const checklistCompletionPercent = useMemo(() => {
    if (!slotSummaries.length) return 0;
    const totalProgress = slotSummaries.reduce((sum, slot) => sum + slot.progress, 0);
    return Math.round(totalProgress / slotSummaries.length);
  }, [slotSummaries]);

  const compiledPackets = useMemo(() => {
    const jobs = (caseData?.compileJobs ?? []) as CompileJobSummary[];
    return jobs
      .filter((j) => j.status === 'completed' && j.artifact)
      .map((j, idx, arr) => {
        const meta = j.artifact?.optionsHash ? (() => { try { return JSON.parse(j.artifact!.optionsHash!); } catch { return {}; } })() : {};
        return {
          jobId: j.id,
          artifactId: j.artifact!.id,
          version: arr.length - idx,
          createdAt: j.artifact!.createdAt || j.createdAt,
          reviewedAt: meta.reviewedAt as string | null ?? null,
          riskLevel: meta.lastAuditRiskLevel as string | null ?? null,
        };
      });
  }, [caseData?.compileJobs]);

  const handleGenerateEER = async (scope: {
    whole: boolean;
    documentIds?: string[];
  }) => {
    if (!token || !caseData) return;

    setIsGeneratingEER(true);
    try {
      if (scope.documentIds?.length) {
        const reviewResponse = await api.eer.reviewDocuments(caseId, scope.documentIds, token);
        setDocumentReviews(reviewResponse.reviews as Array<{
          documentId: string;
          originalName: string;
          category?: string | null;
          review: DocumentReviewResult;
          reviewDocumentId?: string | null;
          reviewDocumentName?: string | null;
        }>);
        setEerItems([]);
        await fetchCase();
      } else {
        const newEer = await api.eer.generate(
          caseId,
          caseData.criteriaSelected || [],
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
        setDocumentReviews([]);
        setEerItems(items);
      }
      fetchCase();
    } catch (error) {
      console.error('Failed to generate EER:', error);
    } finally {
      setIsGeneratingEER(false);
    }
  };

  const handleRunPacketAudit = (jobId: string) => {
    const packet = compiledPackets.find((p) => p.jobId === jobId);
    setLatestCompileJobId(jobId);
    setAuditPacketVersion(packet?.version);
    setSavedReportJobId(null);
    setEERModalOpen(false);
    setPacketReviewOpen(true);
  };

  const handleDownloadPacket = async (jobId: string, version: number) => {
    if (!token) return;
    try {
      const blob = await api.cases.compile.download(caseId, jobId, token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EB1A-Packet-v${version}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const handleViewAuditReport = (jobId: string, version?: number) => {
    const packet = compiledPackets.find((p) => p.jobId === jobId);
    setLatestCompileJobId(jobId);
    setAuditPacketVersion(version ?? packet?.version);
    setSavedReportJobId(jobId);
    setPacketReviewOpen(true);
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

  if (accessError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
            <Lock className="h-8 w-8 text-warning" />
          </div>
          <h2 className="text-xl font-semibold">App access expired</h2>
          <p className="mt-2 max-w-md text-foreground-secondary">
            {accessError}
          </p>
          <p className="mt-2 text-sm text-foreground-muted">
            Your case data is preserved. Renew your plan to continue.
          </p>
          <Link href="/account/plans" className="mt-6">
            <Button variant="secondary">View Plans</Button>
          </Link>
          <Link href="/case" className="mt-4 inline-block text-sm text-primary hover:underline">
            Back to My Case
          </Link>
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
          </div>

          <Button variant="primary" onClick={() => setCompileModalOpen(true)}>
            <FileStack className="mr-2 h-4 w-4" />
            Compile Officer Packet
          </Button>
        </div>

        {/* Tool Cards */}
        <div className="mt-6">
          <ToolCards onToolClick={handleToolClick} />
        </div>

        {/* Full-width Submission Checklist */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Submission Checklist</h2>
          <ChecklistAccordion
            caseId={caseId}
            documents={caseData?.documents || []}
            documentBuilders={caseData?.documentBuilders || []}
            criteriaStatuses={criteriaStatuses}
            onCriteriaStatusChange={(criterionId, status) =>
              setCriteriaStatuses((prev) => ({ ...prev, [criterionId]: status }))
            }
            onAddEvidence={(_, __, slotType) => focusChecklistSlot(slotType, 'upload')}
            onCreateWithAI={(_, __, slotType) => openDraftForSlot(slotType)}
            onOpenTemplate={(_, slotType) => {
              const config = getChecklistBuilderConfig(slotType);
              if (config?.templateUrl) {
                handleOpenFormTemplate(slotType);
                return;
              }
              setTemplateSlot(slotType);
            }}
            onGenerateNarrative={() => setActiveTool('document-assistant')}
            onUploadSuccess={fetchCase}
            onOpenDocument={(docId, docName) => setViewerDoc({ id: docId, name: docName || '' })}
            focusedSlotType={focusedSlotType}
            focusMode={slotFocusMode}
            onFocusHandled={() => setFocusedSlotType(null)}
            compiledPackets={compiledPackets}
            onRunAudit={handleRunPacketAudit}
            onDownloadPacket={handleDownloadPacket}
            onViewAuditReport={handleViewAuditReport}
            uploadEnabled={user?.uploadEnabled === true}
          />
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
        onCreateDraft={(item) => {
          const slotType = item.deepLink?.slotType || item.suggestedTemplate;
          if (slotType) {
            openDraftForSlot(slotType);
            return;
          }
          setActiveTool('document-assistant');
        }}
        onDeepLink={(item) => {
          if (item.deepLink?.slotType) {
            focusChecklistSlot(item.deepLink.slotType, 'open');
          }
        }}
        isGenerating={isGeneratingEER}
        caseDocuments={(caseData?.documents || []).map((d: any) => ({
          id: d.id,
          originalName: d.originalName,
          mimeType: d.mimeType,
          category: d.category,
          metadata: d.metadata,
        }))}
        onDocumentsRefresh={fetchCase}
        documentReviews={documentReviews}
        compiledPackets={compiledPackets}
        onRunPacketAudit={handleRunPacketAudit}
      />

      <DocumentAssistantModal
        toolId={activeTool}
        onClose={() => setActiveTool(null)}
        caseId={caseId}
        onOpenSlot={openDraftForSlot}
      />
      <AdvisorChatModal
        toolId={activeTool}
        onClose={() => setActiveTool(null)}
        caseId={caseId}
        caseDocuments={(caseData?.documents || []).map((d: any) => ({
          id: d.id,
          originalName: d.originalName,
          mimeType: d.mimeType,
          category: d.category,
        }))}
        onDocumentsRefresh={fetchCase}
      />

      <CompileModal
        open={compileModalOpen}
        onClose={() => setCompileModalOpen(false)}
        caseId={caseId}
        criteriaSelected={caseData?.criteriaSelected || []}
        onComplete={fetchCase}
      />

      <DocumentViewerModal
        open={!!viewerDoc}
        onClose={() => setViewerDoc(null)}
        docId={viewerDoc?.id ?? null}
        docName={viewerDoc?.name}
      />

      <DocumentTemplateViewer
        open={!!templateSlot}
        onClose={() => setTemplateSlot(null)}
        config={templateSlot ? DOCUMENT_ASSISTANT_BUILDER_MAP[templateSlot] ?? null : null}
      />

      <DocumentBuilderModal
        key={activeBuilderSlot ?? 'builder-closed'}
        open={!!activeBuilderSlot}
        onClose={() => setActiveBuilderSlot(null)}
        caseId={caseId}
        config={activeBuilderSlot ? DOCUMENT_ASSISTANT_BUILDER_MAP[activeBuilderSlot] ?? null : null}
        documents={caseData?.documents || []}
        onSaved={fetchCase}
      />

      <PacketReviewModal
        caseId={caseId}
        latestCompileJobId={latestCompileJobId}
        open={packetReviewOpen}
        onClose={() => { setPacketReviewOpen(false); setSavedReportJobId(null); }}
        onReviewComplete={fetchCase}
        packetVersion={auditPacketVersion}
        savedReportJobId={savedReportJobId}
      />
    </DashboardLayout>
  );
}
