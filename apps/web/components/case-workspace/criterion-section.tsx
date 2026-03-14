'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles, FileText, ExternalLink, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CRITERIA, CRITERION_SLOTS } from '@aipas/shared';
import { DocumentUploadBlock } from './document-upload-block';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { CriterionEvidenceStatus } from '@aipas/shared';

interface Document {
  id: string;
  originalName: string;
  metadata?: { slotType?: string };
}

const CRITERION_STATUS_OPTIONS: { value: CriterionEvidenceStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'supported', label: 'Supported' },
  { value: 'strongly_supported', label: 'Strongly supported' },
  { value: 'not_pursued', label: 'Not pursued' },
];

interface CriterionSectionProps {
  caseId: string;
  documents: Document[];
  criteriaStatuses: Record<string, CriterionEvidenceStatus>;
  onStatusChange: (criterionId: string, status: CriterionEvidenceStatus) => void;
  onAddEvidence: (sectionId: string, criterionId: string | null, slotType: string) => void;
  onCreateWithAI: (sectionId: string, criterionId: string | null, slotType: string) => void;
  onGenerateNarrative: (criterionId: string) => void;
  onUploadSuccess?: () => void;
  onOpenDocument?: (docId: string, docName?: string) => void;
}

export function CriterionSection({
  caseId,
  documents,
  criteriaStatuses,
  onStatusChange,
  onAddEvidence,
  onCreateWithAI,
  onGenerateNarrative,
  onUploadSuccess,
  onOpenDocument,
}: CriterionSectionProps) {
  const { token } = useAuthStore();
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set(['C1']));
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());
  const [expandedUploadSlot, setExpandedUploadSlot] = useState<string | null>(null);

  const getDocsForSlot = (criterionId: string, slotType: string) => {
    const fullSlot = `s5_${criterionId}_${slotType}`;
    return documents.filter((d) => (d.metadata as any)?.slotType === fullSlot);
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
          alert(err instanceof Error ? err.message : 'Failed to open document');
        }
      );
    }
  };

  const handleDeleteDoc = async (docId: string, docName: string) => {
    if (!token) return;
    if (!confirm(`Delete "${docName}"?`)) return;
    try {
      await api.documents.delete(docId, token);
      onUploadSuccess?.();
    } catch (err) {
      console.error(err);
      alert('Failed to delete document');
    }
  };

  const toggleCriterion = (id: string) => {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {Object.entries(CRITERIA).map(([criterionId, label]) => {
        const isExpanded = expandedCriteria.has(criterionId);
        const status = criteriaStatuses[criterionId] || 'not_started';
        const slots = CRITERION_SLOTS[criterionId] || [];

        return (
          <div
            key={criterionId}
            className="rounded-lg border border-border bg-background-secondary/30 overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => toggleCriterion(criterionId)}
                className="shrink-0 text-foreground-muted hover:text-foreground"
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </button>
              <span className="font-medium text-primary">{criterionId}</span>
              <span className="flex-1 truncate text-sm text-foreground-secondary">
                {label}
              </span>
              <select
                value={status}
                onChange={(e) =>
                  onStatusChange(criterionId, e.target.value as CriterionEvidenceStatus)
                }
                className={cn(
                  'rounded border border-border bg-background-tertiary px-2 py-1 text-sm',
                  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
                )}
              >
                {CRITERION_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {isExpanded && (
              <div className="border-t border-border px-4 py-3 pl-12">
                <div className="space-y-2">
                  {slots.map((slotLabel) => {
                    const slotType = slotLabel.toLowerCase().replace(/\s+/g, '_');
                    const uploadSlotKey = `${criterionId}:${slotType}`;
                    const isSlotExpanded = expandedSlots.has(uploadSlotKey);
                    const isUploadExpanded = expandedUploadSlot === uploadSlotKey;
                    const slotDocs = getDocsForSlot(criterionId, slotType);
                    const count = slotDocs.length;

                    return (
                      <div key={slotLabel} className="rounded border border-border/50 bg-background-tertiary/30 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSlots((prev) => {
                                const next = new Set(prev);
                                if (next.has(uploadSlotKey)) next.delete(uploadSlotKey);
                                else next.add(uploadSlotKey);
                                return next;
                              })
                            }
                            className="flex flex-1 items-center gap-2 text-left min-w-0"
                          >
                            {isSlotExpanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-foreground-muted" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" />
                            )}
                            <span className="text-sm truncate">{slotLabel}</span>
                            {count > 0 && (
                              <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                                {count}
                              </span>
                            )}
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            {slotLabel === 'Narrative' ? (
                              <button
                                type="button"
                                onClick={() => onGenerateNarrative(criterionId)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                Open Document Assistant
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onCreateWithAI('s5', criterionId, slotType)}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                Create
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedUploadSlot((prev) =>
                                  prev === uploadSlotKey ? null : uploadSlotKey
                                )
                              }
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                        {isSlotExpanded && slotDocs.length > 0 && (
                          <div className="border-t border-border/50 px-3 py-2 pl-9 space-y-1">
                            {slotDocs.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-background-secondary group"
                              >
                                <FileText className="h-4 w-4 shrink-0 text-foreground-muted" />
                                <button
                                  type="button"
                                  onClick={() => handleOpenDoc(doc.id, doc.originalName)}
                                  className="flex flex-1 items-center gap-2 min-w-0 text-left text-sm"
                                >
                                  <span className="truncate text-primary hover:underline">{doc.originalName}</span>
                                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-foreground-muted opacity-70 group-hover:opacity-100" aria-label="Open" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDoc(doc.id, doc.originalName)}
                                  className="shrink-0 rounded p-1 text-foreground-muted hover:bg-destructive/10 hover:text-destructive transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {isUploadExpanded && (
                          <div className="border-t border-border/50 ml-2 mt-2 p-2">
                            <DocumentUploadBlock
                              caseId={caseId}
                              category={`s5_${criterionId}_${slotType}`}
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
