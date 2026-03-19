'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  ExternalLink,
  Trash2,
  FileStack,
  Download,
  ShieldCheck,
  ShieldX,
  Calendar,
} from 'lucide-react';
import {
  CHECKLIST_SECTIONS,
  getDocumentBuilderSummary,
  type DocumentBuilderDocumentLike,
  type DocumentBuilderStateLike,
} from '@aipas/shared';
import { DocumentUploadBlock } from './document-upload-block';
import { CHECKLIST_SLOT_CONFIGS, getChecklistBuilderConfig } from './checklist-slots';
import { DocumentActionBar, UploadDisabledPopover } from './document-action-bar';
import { DocumentReviewIndicator, isReviewArtifact } from './document-review-indicator';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { CriterionEvidenceStatus } from '@aipas/shared';

interface Document extends DocumentBuilderDocumentLike {
  id: string;
  originalName: string;
}

interface DocumentBuilderState extends DocumentBuilderStateLike {
  id: string;
}

export interface CompiledPacketEntry {
  jobId: string;
  artifactId: string;
  version: number;
  createdAt: string;
  reviewedAt: string | null;
  riskLevel: string | null;
}

interface ChecklistAccordionProps {
  caseId: string;
  documents: Document[];
  documentBuilders?: DocumentBuilderState[];
  criteriaStatuses: Record<string, CriterionEvidenceStatus>;
  onCriteriaStatusChange: (criterionId: string, status: CriterionEvidenceStatus) => void;
  onAddEvidence: (sectionId: string, criterionId: string | null, slotType: string) => void;
  onCreateWithAI: (sectionId: string, criterionId: string | null, slotType: string) => void;
  onOpenTemplate: (sectionId: string, slotType: string) => void;
  onGenerateNarrative: (criterionId: string) => void;
  onUploadSuccess?: () => void;
  onOpenDocument?: (docId: string, docName?: string) => void;
  focusedSlotType?: string | null;
  focusMode?: 'open' | 'upload';
  onFocusHandled?: () => void;
  compiledPackets?: CompiledPacketEntry[];
  onRunAudit?: (jobId: string) => void;
  onDownloadPacket?: (jobId: string, version: number) => void;
  onViewAuditReport?: (jobId: string, version: number) => void;
  uploadEnabled?: boolean;
}

function findSectionIdForSlot(slotType: string): string | null {
  for (const [sectionId, slots] of Object.entries(CHECKLIST_SLOT_CONFIGS)) {
    if (slots.some((slot) => slot.slotType === slotType)) {
      return sectionId;
    }
  }
  return null;
}

export function ChecklistAccordion({
  caseId,
  documents,
  documentBuilders = [],
  criteriaStatuses,
  onCriteriaStatusChange,
  onAddEvidence,
  onCreateWithAI,
  onOpenTemplate,
  onGenerateNarrative,
  onUploadSuccess,
  onOpenDocument,
  focusedSlotType,
  focusMode = 'open',
  onFocusHandled,
  compiledPackets = [],
  onRunAudit,
  onDownloadPacket,
  onViewAuditReport,
  uploadEnabled = false,
}: ChecklistAccordionProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['s1', 's5']));
  const [openS11Rows, setOpenS11Rows] = useState<Set<string>>(new Set());

  const toggleS11Row = (rowId: string) => {
    setOpenS11Rows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  useEffect(() => {
    if (!focusedSlotType) return;
    const sectionId = findSectionIdForSlot(focusedSlotType);
    if (!sectionId) {
      onFocusHandled?.();
      return;
    }

    setOpenSections((prev) => {
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });
  }, [focusedSlotType, onFocusHandled]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reviewedPackets = compiledPackets.filter((p) => p.reviewedAt);

  return (
    <div className="space-y-1">
      {CHECKLIST_SECTIONS.map((section) => {
        const isOpen = openSections.has(section.id);

        if (section.id === 's11') {
          return (
            <div
              key={section.id}
              className="rounded-lg border border-border bg-background-card overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-background-secondary/50 transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-foreground-muted" />
                ) : (
                  <ChevronRight className="h-5 w-5 shrink-0 text-foreground-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{section.title}</span>
                </div>
                {compiledPackets.length > 0 && (
                  <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                    {compiledPackets.length} пакет{compiledPackets.length === 1 ? '' : 'ов'}
                    {reviewedPackets.length > 0 && ` · ${reviewedPackets.length} проверено`}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="border-t border-border px-4 py-4">
                  <div className="space-y-2">
                    {/* 11.A — Compiled Packets (collapsible row) */}
                    <div className="rounded-lg border border-border bg-background-secondary/50 overflow-hidden">
                      <div className="flex flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                        <button
                          type="button"
                          onClick={() => toggleS11Row('11a')}
                          className="flex flex-1 items-center gap-2 text-left min-w-0"
                        >
                          {openS11Rows.has('11a') ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-foreground-muted" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" />
                          )}
                          <span className="block text-sm text-white">Собранные пакеты</span>
                          {compiledPackets.length > 0 && (
                            <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                              {compiledPackets.length}
                            </span>
                          )}
                        </button>
                      </div>
                      {openS11Rows.has('11a') && (
                        <div className="border-t border-border px-3 py-2 pl-9 space-y-2">
                          {compiledPackets.length === 0 ? (
                            <p className="text-sm text-foreground-muted">
                              Собранных пакетов пока нет. Используйте «Собрать пакет для офицера».
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {compiledPackets.map((packet) => (
                                <div
                                  key={packet.jobId}
                                  className="flex flex-col gap-3 rounded px-2 py-1.5 hover:bg-background-tertiary group sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <FileStack className="h-4 w-4 text-primary shrink-0" />
                                    <span className="text-sm text-white">Версия {packet.version}</span>
                                    <span className="text-xs text-foreground-muted">
                                      {new Date(packet.createdAt).toLocaleDateString(undefined, {
                                        month: 'short', day: 'numeric', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                      })}
                                    </span>
                                    {packet.reviewedAt ? (
                                      <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-700">
                                        <ShieldCheck className="h-3 w-3" />
                                        Проверено
                                        {packet.riskLevel && (
                                          <span className="ml-0.5 opacity-70">
                                            ({packet.riskLevel.replace('_', ' ')})
                                          </span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-[11px] font-medium text-foreground-muted">
                                        <ShieldX className="h-3 w-3" />
                                        Не проверено
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                                    {onRunAudit && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        className="min-h-[44px] sm:min-h-0"
                                        onClick={() => onRunAudit(packet.jobId)}
                                      >
                                        {packet.reviewedAt ? 'Повторить аудит' : 'Запустить аудит'}
                                      </Button>
                                    )}
                                    {onDownloadPacket && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                                        onClick={() => onDownloadPacket(packet.jobId, packet.version)}
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 11.B — Reviewed Packets / Final Audits (collapsible row) */}
                    <div className="rounded-lg border border-border bg-background-secondary/50 overflow-hidden">
                      <div className="flex flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                        <button
                          type="button"
                          onClick={() => toggleS11Row('11b')}
                          className="flex flex-1 items-center gap-2 text-left min-w-0"
                        >
                          {openS11Rows.has('11b') ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-foreground-muted" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" />
                          )}
                          <span className="block text-sm text-white">Проверенные пакеты / Финальные аудиты</span>
                          {reviewedPackets.length > 0 && (
                            <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                              {reviewedPackets.length}
                            </span>
                          )}
                        </button>
                      </div>
                      {openS11Rows.has('11b') && (
                        <div className="border-t border-border px-3 py-2 pl-9 space-y-2">
                          {reviewedPackets.length === 0 ? (
                            <p className="text-sm text-foreground-muted">
                              Завершённых аудитов пока нет. Запустите финальный аудит собранного пакета.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {reviewedPackets.map((packet) => {
                                const riskColors: Record<string, string> = {
                                  low_risk: 'border-green-200/20 bg-green-500/5',
                                  medium_risk: 'border-yellow-200/20 bg-yellow-500/5',
                                  high_risk: 'border-orange-200/20 bg-orange-500/5',
                                  critical_gaps: 'border-red-200/20 bg-red-500/5',
                                };
                                const riskLabels: Record<string, string> = {
                                  low_risk: 'Низкий риск',
                                  medium_risk: 'Средний риск',
                                  high_risk: 'Высокий риск',
                                  critical_gaps: 'Критические пробелы',
                                };
                                const riskTextColors: Record<string, string> = {
                                  low_risk: 'text-green-400',
                                  medium_risk: 'text-yellow-400',
                                  high_risk: 'text-orange-400',
                                  critical_gaps: 'text-red-400',
                                };
                                const riskStyle = riskColors[packet.riskLevel ?? ''] ?? '';
                                const riskLabel = riskLabels[packet.riskLevel ?? ''] ?? 'Неизвестно';
                                const riskTextColor = riskTextColors[packet.riskLevel ?? ''] ?? 'text-foreground-muted';

                                return (
                                  <div
                                    key={`audit-${packet.jobId}`}
                                    className={`flex flex-col gap-3 rounded px-2 py-1.5 hover:bg-background-tertiary group sm:flex-row sm:items-center sm:justify-between ${riskStyle}`}
                                  >
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      <ShieldCheck className={`h-4 w-4 shrink-0 ${riskTextColor}`} />
                                      <span className="text-sm text-white">
                                        Версия {packet.version} — <span className={riskTextColor}>{riskLabel}</span>
                                      </span>
                                      <span className="text-xs text-foreground-muted">
                                        <Calendar className="inline h-3 w-3 mr-0.5" />
                                        {new Date(packet.reviewedAt!).toLocaleDateString(undefined, {
                                          month: 'short', day: 'numeric', year: 'numeric',
                                          hour: '2-digit', minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                      {onViewAuditReport && (
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          className="min-h-[44px] sm:min-h-0"
                                          onClick={() => onViewAuditReport(packet.jobId, packet.version)}
                                        >
                                          Открыть отчёт
                                        </Button>
                                      )}
                                      {onRunAudit && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="min-h-[44px] sm:min-h-0"
                                          onClick={() => onRunAudit(packet.jobId)}
                                        >
                                          Повторить аудит
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }

        return (
          <div
            key={section.id}
            className="rounded-lg border border-border bg-background-card"
          >
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-background-secondary/50 transition-colors rounded-t-lg"
            >
              {isOpen ? (
                <ChevronDown className="h-5 w-5 shrink-0 text-foreground-muted" />
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-foreground-muted" />
              )}
              <div className="min-w-0 flex-1">
                <span className="font-medium">{section.title}</span>
                {section.subtitle && (
                  <span className="ml-2 text-sm text-foreground-secondary">
                    — {section.subtitle}
                  </span>
                )}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border px-4 py-4">
                <ChecklistSectionContent
                  caseId={caseId}
                  sectionId={section.id}
                  documents={documents}
                  documentBuilders={documentBuilders}
                  onAddEvidence={onAddEvidence}
                  onCreateWithAI={onCreateWithAI}
                  onOpenTemplate={onOpenTemplate}
                  onUploadSuccess={onUploadSuccess}
                  onOpenDocument={onOpenDocument}
                  focusedSlotType={focusedSlotType}
                  focusMode={focusMode}
                  onFocusHandled={onFocusHandled}
                  uploadEnabled={uploadEnabled}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChecklistSectionContent({
  caseId,
  sectionId,
  documents,
  documentBuilders,
  onAddEvidence,
  onCreateWithAI,
  onOpenTemplate,
  onUploadSuccess,
  onOpenDocument,
  focusedSlotType,
  focusMode,
  onFocusHandled,
  uploadEnabled = false,
}: {
  caseId: string;
  sectionId: string;
  documents: Document[];
  documentBuilders: DocumentBuilderState[];
  onAddEvidence: (sectionId: string, criterionId: string | null, slotType: string) => void;
  onCreateWithAI: (sectionId: string, criterionId: string | null, slotType: string) => void;
  onOpenTemplate: (sectionId: string, slotType: string) => void;
  onUploadSuccess?: () => void;
  onOpenDocument?: (docId: string, docName?: string) => void;
  focusedSlotType?: string | null;
  focusMode?: 'open' | 'upload';
  onFocusHandled?: () => void;
  uploadEnabled?: boolean;
}) {
  const { token } = useAuthStore();
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());
  const [expandedUploadSlot, setExpandedUploadSlot] = useState<string | null>(null);
  const [showUploadMsg, setShowUploadMsg] = useState<string | null>(null);
  const addBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const isUploadBlocked = !uploadEnabled;

  const getDocsForSlot = (slotType: string) => {
    const slotRoots = documents.filter(
      (d) =>
        (d.metadata as any)?.slotType === slotType &&
        !isReviewArtifact(d.metadata as Record<string, unknown> | undefined)
    );
    const slotDocIds = new Set(slotRoots.map((doc) => doc.id));
    const slotDocs = [
      ...slotRoots,
      ...documents.filter((doc) => {
        const reviewForDocumentId = (doc.metadata as any)?.reviewForDocumentId as string | undefined;
        return Boolean(
          reviewForDocumentId &&
            slotDocIds.has(reviewForDocumentId) &&
            isReviewArtifact(doc.metadata as Record<string, unknown> | undefined)
        );
      }),
    ];
    const linkedReviews = new Map<string, Document[]>();
    const orderedRoots: Document[] = [];
    const orphanedReviews: Document[] = [];

    slotDocs.forEach((doc) => {
      const reviewForDocumentId = (doc.metadata as any)?.reviewForDocumentId as string | undefined;
      if (reviewForDocumentId && slotDocIds.has(reviewForDocumentId)) {
        linkedReviews.set(reviewForDocumentId, [...(linkedReviews.get(reviewForDocumentId) ?? []), doc]);
      } else if (isReviewArtifact(doc.metadata as Record<string, unknown> | undefined)) {
        orphanedReviews.push(doc);
      } else {
        orderedRoots.push(doc);
      }
    });

    return [
      ...orderedRoots.flatMap((doc) => [doc, ...(linkedReviews.get(doc.id) ?? [])]),
      ...orphanedReviews,
    ];
  };
  const slots = CHECKLIST_SLOT_CONFIGS[sectionId] || [];

  useEffect(() => {
    if (!focusedSlotType || !slots.some((slot) => slot.slotType === focusedSlotType)) return;

    setExpandedSlots((prev) => {
      const next = new Set(prev);
      next.add(focusedSlotType);
      return next;
    });

    if (focusMode === 'upload') {
      setExpandedUploadSlot(focusedSlotType);
    }

    onFocusHandled?.();
  }, [focusedSlotType, focusMode, onFocusHandled, slots]);

  const toggleSlot = (slotType: string) => {
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slotType)) next.delete(slotType);
      else next.add(slotType);
      return next;
    });
  };

  const handleOpenDoc = (docId: string, docName: string) => {
    if (onOpenDocument) {
      onOpenDocument(docId, docName);
    } else if (token) {
      api.documents.getFileBlobUrl(docId, token).then(
        (url) => {
          window.open(url, '_blank', 'noopener');
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        },
        (err) => {
          console.error(err);
          alert(err instanceof Error ? err.message : 'Не удалось открыть документ');
        }
      );
    }
  };

  const handleDeleteDoc = async (docId: string, docName: string) => {
    if (!token) return;
    if (!confirm(`Удалить «${docName}»?`)) return;
    try {
      await api.documents.delete(docId, token);
      onUploadSuccess?.();
    } catch (err) {
      console.error(err);
          alert('Не удалось удалить документ');
    }
  };

  return (
    <div className="space-y-2">
      {slots.map(({ label, slotType, support }) => {
        const slotDocs = getDocsForSlot(slotType);
        const slotSummary = getDocumentBuilderSummary(slotType, documents, documentBuilders);
        const count = slotSummary.documentCount;
        const isExpanded = expandedSlots.has(slotType);
        const isUploadOpen = expandedUploadSlot === slotType;
        const slotStatus = slotSummary.status;
        const builderProgress = slotSummary.progress;
        const builderConfig = getChecklistBuilderConfig(slotType);
        const showFullActionBar = support === 'builder';
        const isFillMode = builderConfig?.assistantMode === 'fill';

        return (
          <div key={slotType} className="rounded-lg border border-border bg-background-secondary/50">
            <div className="flex flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
              <button
                type="button"
                onClick={() => toggleSlot(slotType)}
                className="flex flex-1 items-center gap-2 text-left min-w-0"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-foreground-muted" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" />
                )}
                <div className="min-w-0">
                  <span className="block text-sm truncate text-white">{label}</span>
                  {builderConfig ? (
                    <>
                      <span className="block text-xs text-foreground-muted">{builderConfig.description}</span>
                      {slotStatus !== 'not_started' ? (
                        <span className="block text-[11px] text-foreground-muted">
                          Прогресс: {builderProgress}% готово
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
                {count > 0 && (
                  <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                    {count}
                  </span>
                )}
              </button>
              {showFullActionBar ? (
                <DocumentActionBar
                  status={slotStatus}
                  progress={builderProgress}
                  uploadDisabled={isUploadBlocked}
                  onAdd={() => {
                    if (isUploadBlocked) return;
                    setExpandedUploadSlot((prev) => (prev === slotType ? null : slotType));
                    onAddEvidence(sectionId, null, slotType);
                  }}
                  onCreate={() => onCreateWithAI(sectionId, null, slotType)}
                  onTemplate={() => onOpenTemplate(sectionId, slotType)}
                  primaryActionLabel={isFillMode ? 'Заполнить' : 'Создать'}
                />
              ) : (
                <>
                  <button
                    ref={(el) => { if (el) addBtnRefs.current.set(slotType, el); }}
                    type="button"
                    onClick={() => {
                      if (isUploadBlocked) {
                        setShowUploadMsg((prev) => (prev === slotType ? null : slotType));
                        return;
                      }
                      setExpandedUploadSlot((prev) => (prev === slotType ? null : slotType));
                    }}
                    className={`text-sm font-medium ${
                      isUploadBlocked
                        ? 'text-foreground-muted cursor-not-allowed opacity-50'
                        : 'text-primary hover:underline'
                    }`}
                  >
                    + Добавить
                  </button>
                  {showUploadMsg === slotType && (
                    <UploadDisabledPopover
                      anchorRef={{ current: addBtnRefs.current.get(slotType) ?? null }}
                      onClose={() => setShowUploadMsg(null)}
                    />
                  )}
                </>
              )}
            </div>

            {isExpanded && (
              <div className="border-t border-border px-3 py-2 pl-9 space-y-2">
                {slotDocs.length > 0 && (
                  <div className="space-y-1">
                    {slotDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-background-tertiary group"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-foreground-muted" />
                        <button
                          type="button"
                          onClick={() => handleOpenDoc(doc.id, doc.originalName)}
                          className="flex flex-1 items-center gap-2 min-w-0 text-left text-sm"
                        >
                          <DocumentReviewIndicator metadata={doc.metadata as Record<string, unknown> | undefined} />
                          <span className="truncate text-primary hover:underline">{doc.originalName}</span>
                          {isReviewArtifact(doc.metadata as Record<string, unknown> | undefined) && (
                            <span className="shrink-0 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-200">
                              Проверка
                            </span>
                          )}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-foreground-muted opacity-70 group-hover:opacity-100" aria-label="Open" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc(doc.id, doc.originalName)}
                          className="shrink-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-2 text-foreground-muted hover:bg-destructive/10 hover:text-destructive transition-colors sm:min-h-0 sm:min-w-0 sm:p-1"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {isUploadOpen && !isUploadBlocked && (
                  <DocumentUploadBlock
                    caseId={caseId}
                    category={slotType}
                    source="upload"
                    acceptedMode={builderConfig ? 'documents_only' : 'default'}
                    acceptedLabel={builderConfig ? 'PDF, DOC, DOCX, TXT' : undefined}
                    onUploadSuccess={() => {
                      setExpandedUploadSlot(null);
                      onUploadSuccess?.();
                    }}
                    onClose={() => setExpandedUploadSlot(null)}
                  />
                )}
              </div>
            )}

            {!isExpanded && isUploadOpen && !isUploadBlocked && (
              <div className="border-t border-border px-3 py-2 pl-9">
                <DocumentUploadBlock
                  caseId={caseId}
                  category={slotType}
                  source="upload"
                  acceptedMode={builderConfig ? 'documents_only' : 'default'}
                  acceptedLabel={builderConfig ? 'PDF, DOC, DOCX, TXT' : undefined}
                  onUploadSuccess={() => {
                    setExpandedUploadSlot(null);
                    onUploadSuccess?.();
                  }}
                  onClose={() => setExpandedUploadSlot(null)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
