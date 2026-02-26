'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CRITERIA } from '@lms-eb1a/shared';
import type { EERReportItem } from '@lms-eb1a/shared';

interface EERModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  eerReports: EERReportItem[];
  onGenerate: (scope: { whole: boolean; criteria?: string[]; documentTypes?: string[] }) => void;
  onMarkResolved: (itemId: string) => void;
  onCreateDraft: (itemId: string) => void;
  onDeepLink: (item: EERReportItem) => void;
  isGenerating?: boolean;
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
}: EERModalProps) {
  const [reviewScope, setReviewScope] = useState<'whole' | 'criteria' | 'documents'>('whole');
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);

  const handleRunReview = () => {
    if (reviewScope === 'whole') {
      onGenerate({ whole: true });
    } else if (reviewScope === 'criteria') {
      onGenerate({ whole: false, criteria: selectedCriteria });
    } else {
      onGenerate({ whole: false, documentTypes: selectedDocTypes });
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

  return (
    <Dialog open={open} onClose={onClose} title="Submit for Review (Officer Review)" className="max-w-3xl">
      <div className="p-6 space-y-6">
        <div className="rounded-lg border border-border bg-background-secondary p-4">
          <p className="text-sm text-foreground-secondary">
            <strong>Disclaimer:</strong> This review does not provide legal advice or predict
            immigration outcomes. The system outputs Enhancement Evidence Requests (EER) only.
            No approval language or odds predictions.
          </p>
        </div>

        <div>
          <h3 className="font-medium mb-3">Review scope</h3>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scope"
                checked={reviewScope === 'whole'}
                onChange={() => setReviewScope('whole')}
                className="rounded border-border"
              />
              <span className="text-sm">Whole package</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scope"
                checked={reviewScope === 'criteria'}
                onChange={() => setReviewScope('criteria')}
                className="rounded border-border"
              />
              <span className="text-sm">By criterion</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scope"
                checked={reviewScope === 'documents'}
                onChange={() => setReviewScope('documents')}
                className="rounded border-border"
              />
              <span className="text-sm">By document type</span>
            </label>
          </div>

          {reviewScope === 'criteria' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.keys(CRITERIA).map((c) => (
                <label key={c} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCriteria.includes(c)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedCriteria([...selectedCriteria, c]);
                      else setSelectedCriteria(selectedCriteria.filter((x) => x !== c));
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-xs">{c}</span>
                </label>
              ))}
            </div>
          )}

          {reviewScope === 'documents' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {['letters', 'translations', 'brief'].map((t) => (
                <label key={t} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDocTypes.includes(t)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedDocTypes([...selectedDocTypes, t]);
                      else setSelectedDocTypes(selectedDocTypes.filter((x) => x !== t));
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-xs capitalize">{t}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={handleRunReview}
          isLoading={isGenerating}
          className="w-full"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Run Review → Generate EER
        </Button>

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
                            onClick={() => onCreateDraft(item.id)}
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
