'use client';

import { useState, useMemo } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  FileStack,
  Upload,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentReviewResult, EERReportItem } from '@aipas/shared';
import { DocumentAttachmentPicker, type AttachableDocument } from './document-attachment-picker';
import { formatDocumentReviewStatus } from './document-review-indicator';

interface CompiledPacketInfo {
  jobId: string;
  version: number;
  createdAt: string;
  reviewedAt: string | null;
  riskLevel: string | null;
}

interface EERModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  eerReports: EERReportItem[];
  onGenerate: (scope: { whole: boolean; documentIds?: string[] }) => void;
  onMarkResolved: (itemId: string) => void;
  onCreateDraft: (item: EERReportItem) => void;
  onDeepLink: (item: EERReportItem) => void;
  isGenerating?: boolean;
  caseDocuments?: AttachableDocument[];
  onDocumentsRefresh?: () => void;
  documentReviews?: Array<{
    documentId: string;
    originalName: string;
    category?: string | null;
    review: DocumentReviewResult;
  }>;
  compiledPackets?: CompiledPacketInfo[];
  onRunPacketAudit?: (jobId: string) => void;
  onUploadExternalPacket?: (file: File) => void;
}

export function EERModal({
  open,
  onClose,
  caseId,
  eerReports,
  onGenerate,
  onMarkResolved,
  onCreateDraft,
  onDeepLink,
  isGenerating = false,
  caseDocuments = [],
  onDocumentsRefresh,
  documentReviews = [],
  compiledPackets = [],
  onRunPacketAudit,
  onUploadExternalPacket,
}: EERModalProps) {
  const [reviewScope, setReviewScope] = useState<'selected_documents' | 'whole'>('selected_documents');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [packetSource, setPacketSource] = useState<'saved' | 'upload'>('saved');
  const [selectedPacketJobId, setSelectedPacketJobId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showPacketPicker, setShowPacketPicker] = useState(false);

  const defaultPacket = useMemo(() => {
    const unreviewed = compiledPackets.find((p) => !p.reviewedAt);
    return unreviewed ?? compiledPackets[0] ?? null;
  }, [compiledPackets]);

  const activePacketJobId = selectedPacketJobId ?? defaultPacket?.jobId ?? null;
  const activePacket = compiledPackets.find((p) => p.jobId === activePacketJobId) ?? defaultPacket;

  const handleRunReview = () => {
    if (reviewScope === 'whole') {
      if (packetSource === 'saved' && activePacketJobId && onRunPacketAudit) {
        onRunPacketAudit(activePacketJobId);
      } else if (packetSource === 'upload' && uploadedFile && onUploadExternalPacket) {
        onUploadExternalPacket(uploadedFile);
      }
    } else {
      onGenerate({ whole: false, documentIds: selectedDocIds });
    }
  };

  const isRunDisabled = (() => {
    if (reviewScope === 'selected_documents') return selectedDocIds.length === 0;
    if (packetSource === 'saved') return !activePacketJobId;
    return !uploadedFile;
  })();

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

  return (
    <Dialog open={open} onClose={onClose} title="Review & Audit" className="max-w-3xl">
      <div className="p-6 space-y-6">
        <div className="rounded-lg border border-border bg-background-secondary p-4">
          <p className="text-sm text-foreground-secondary">
            <strong>Disclaimer:</strong> This review does not provide legal advice or predict
            immigration outcomes. Document review outputs Enhancement Evidence Requests (EER).
            Whole-packet audit produces a Final Audit Report with risk assessment.
          </p>
        </div>

        {/* Scope selection */}
        <div>
          <h3 className="font-medium mb-3">Review scope</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setReviewScope('selected_documents')}
              className={cn(
                'rounded-lg border-2 p-4 text-left transition-colors',
                reviewScope === 'selected_documents'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-foreground-muted'
              )}
            >
              <div className="font-medium text-sm">Selected document(s)</div>
              <p className="text-xs text-foreground-secondary mt-1">
                Review individual documents for quality, evidence strength, and gaps
              </p>
            </button>
            <button
              type="button"
              onClick={() => setReviewScope('whole')}
              className={cn(
                'rounded-lg border-2 p-4 text-left transition-colors',
                reviewScope === 'whole'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-foreground-muted'
              )}
            >
              <div className="font-medium text-sm">Whole package</div>
              <p className="text-xs text-foreground-secondary mt-1">
                Run a Final Audit on a compiled officer packet
              </p>
            </button>
          </div>
        </div>

        {/* Selected documents path */}
        {reviewScope === 'selected_documents' && (
          <div>
            <DocumentAttachmentPicker
              caseId={caseId}
              documents={caseDocuments}
              selectedIds={selectedDocIds}
              onSelectionChange={setSelectedDocIds}
              onUploadSuccess={onDocumentsRefresh}
              label="Select documents to review"
            />
          </div>
        )}

        {/* Whole package path */}
        {reviewScope === 'whole' && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Packet source</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPacketSource('saved')}
                className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors',
                  packetSource === 'saved'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-foreground-muted'
                )}
              >
                <FileStack className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-sm">Use saved compiled packet</div>
                  <p className="text-xs text-foreground-secondary mt-1">
                    {compiledPackets.length > 0
                      ? `${compiledPackets.length} version${compiledPackets.length > 1 ? 's' : ''} available`
                      : 'No compiled packets yet'}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPacketSource('upload')}
                className={cn(
                  'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors',
                  packetSource === 'upload'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-foreground-muted'
                )}
              >
                <Upload className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-sm">Upload external packet PDF</div>
                  <p className="text-xs text-foreground-secondary mt-1">
                    Upload a PDF from outside the app for audit
                  </p>
                </div>
              </button>
            </div>

            {/* Saved packet picker */}
            {packetSource === 'saved' && (
              <div className="space-y-2">
                {compiledPackets.length === 0 ? (
                  <div className="rounded-lg border border-border bg-background-secondary p-4 text-center">
                    <p className="text-sm text-foreground-secondary">
                      No compiled packets available. Compile your officer packet first.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Default selection */}
                    {activePacket && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileStack className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">Version {activePacket.version}</span>
                            <span className="text-xs text-foreground-secondary">
                              {new Date(activePacket.createdAt).toLocaleDateString(undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                            {activePacket.reviewedAt ? (
                              <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-700">
                                <ShieldCheck className="h-3 w-3" /> Reviewed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                                <ShieldX className="h-3 w-3" /> Not reviewed
                              </span>
                            )}
                          </div>
                          {compiledPackets.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setShowPacketPicker(!showPacketPicker)}
                              className="text-xs text-primary hover:underline"
                            >
                              {showPacketPicker ? 'Hide' : 'Choose another'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Full list */}
                    {showPacketPicker && (
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background-secondary p-2 space-y-1">
                        {compiledPackets.map((p) => (
                          <button
                            key={p.jobId}
                            type="button"
                            onClick={() => {
                              setSelectedPacketJobId(p.jobId);
                              setShowPacketPicker(false);
                            }}
                            className={cn(
                              'flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors',
                              p.jobId === activePacketJobId
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-background-tertiary'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <FileStack className="h-3.5 w-3.5" />
                              <span>Version {p.version}</span>
                              <span className="text-xs text-foreground-muted">
                                {new Date(p.createdAt).toLocaleDateString(undefined, {
                                  month: 'short', day: 'numeric',
                                })}
                              </span>
                            </div>
                            {p.reviewedAt ? (
                              <span className="text-[10px] text-green-600">reviewed</span>
                            ) : (
                              <span className="text-[10px] text-foreground-muted">not reviewed</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Upload external packet */}
            {packetSource === 'upload' && (
              <div className="rounded-lg border border-border bg-background-secondary p-4">
                <label className="flex cursor-pointer flex-col items-center gap-2 py-4">
                  <Upload className="h-8 w-8 text-foreground-muted" />
                  <span className="text-sm text-foreground-secondary">
                    {uploadedFile ? uploadedFile.name : 'Click to select a PDF'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {uploadedFile && (
                  <p className="text-xs text-foreground-muted text-center mt-1">
                    {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB — This will be audited without linking to internal packet versions.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Run button */}
        <Button
          onClick={handleRunReview}
          isLoading={isGenerating}
          className="w-full"
          disabled={isRunDisabled}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {reviewScope === 'whole' ? 'Run Final Audit' : 'Run Document Review'}
        </Button>

        {/* Document Review Results */}
        {documentReviews.length > 0 && (
          <div>
            <h3 className="font-medium mb-3">Document Review Results</h3>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {documentReviews.map((item) => (
                <div key={item.documentId} className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.originalName}</p>
                      <p className="text-xs text-foreground-muted">
                        {item.review.documentType}
                        {item.review.relatedCriterion ? ` · ${item.review.relatedCriterion}` : ''}
                        {item.review.relatedSection ? ` · ${item.review.relatedSection}` : ''}
                      </p>
                    </div>
                    <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-200">
                      {formatDocumentReviewStatus(item.review.finalStatus)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Strengths</p>
                      <ul className="mt-1 space-y-1 text-sm text-foreground-secondary">
                        {item.review.strengths.length ? item.review.strengths.map((entry) => <li key={entry}>• {entry}</li>) : <li>• None identified</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Weaknesses</p>
                      <ul className="mt-1 space-y-1 text-sm text-foreground-secondary">
                        {item.review.weaknesses.length ? item.review.weaknesses.map((entry) => <li key={entry}>• {entry}</li>) : <li>• None identified</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Missing context</p>
                      <ul className="mt-1 space-y-1 text-sm text-foreground-secondary">
                        {item.review.missingContext.length ? item.review.missingContext.map((entry) => <li key={entry}>• {entry}</li>) : <li>• None identified</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EER Report */}
        {eerReports.length > 0 && (
          <div>
            <h3 className="font-medium mb-3">EER Report</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {eerReports.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-lg border p-4',
                    getPriorityColor(item.severity)
                  )}
                >
                  <div className="flex items-start gap-3">
                    {getPriorityIcon(item.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="rounded bg-background-tertiary px-2 py-0.5 text-xs font-medium capitalize">
                          {item.severity}
                        </span>
                        {item.criterionId && (
                          <span className="text-xs text-primary">{item.criterionId}</span>
                        )}
                      </div>
                      <p className="font-medium">{item.issue}</p>
                      <p className="mt-1 text-sm text-foreground-secondary">
                        {item.whyItMatters}
                      </p>
                      <p className="mt-1 text-sm">
                        <strong>What to add/fix:</strong> {item.requestedFix}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.deepLink && (
                          <button
                            type="button"
                            onClick={() => onDeepLink(item)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Go to checklist slot →
                          </button>
                        )}
                        {item.suggestedTemplate && (
                          <button
                            type="button"
                            onClick={() => onCreateDraft(item)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Create draft
                          </button>
                        )}
                        {item.status === 'open' ? (
                          <button
                            type="button"
                            onClick={() => onMarkResolved(item.id)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Mark resolved
                          </button>
                        ) : (
                          <span className="text-xs text-success">Resolved</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
