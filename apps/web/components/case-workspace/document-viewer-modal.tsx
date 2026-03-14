'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Loader2 } from 'lucide-react';
import type { DocumentReviewResult } from '@aipas/shared';
import { formatDocumentReviewStatus } from './document-review-indicator';

interface DocumentViewerModalProps {
  open: boolean;
  onClose: () => void;
  docId: string | null;
  docName?: string;
}

export function DocumentViewerModal({
  open,
  onClose,
  docId,
  docName,
}: DocumentViewerModalProps) {
  const { token } = useAuthStore();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [documentReview, setDocumentReview] = useState<DocumentReviewResult | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !docId || !token) {
      setBlobUrl(null);
      setError(null);
      setLoading(false);
      setDocumentReview(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    setDocumentReview(null);

    Promise.all([api.documents.getFileBlobUrl(docId, token), api.documents.get(docId, token)])
      .then(([url, document]) => {
        if (!cancelled) {
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = url;
          setBlobUrl(url);
          setDocumentReview(document?.metadata?.documentReview ?? null);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load document');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [open, docId, token]);

  const handleClose = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setBlobUrl(null);
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={docName || 'Document'}
      className="max-w-5xl w-[95vw]"
    >
      <div className="flex flex-col min-h-[75vh]">
        {documentReview && !loading && !error && (
          <div className="mx-4 mt-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Reviewed by Document Review agent</p>
                <p className="text-xs text-foreground-muted">
                  {documentReview.documentType}
                  {documentReview.relatedCriterion ? ` · ${documentReview.relatedCriterion}` : ''}
                  {documentReview.relatedSection ? ` · ${documentReview.relatedSection}` : ''}
                </p>
              </div>
              <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-200">
                {formatDocumentReviewStatus(documentReview.finalStatus)}
              </span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Strengths</p>
                <ul className="mt-1 space-y-1 text-sm text-foreground-secondary">
                  {documentReview.strengths.length ? documentReview.strengths.map((entry) => <li key={entry}>• {entry}</li>) : <li>• None identified</li>}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Weaknesses</p>
                <ul className="mt-1 space-y-1 text-sm text-foreground-secondary">
                  {documentReview.weaknesses.length ? documentReview.weaknesses.map((entry) => <li key={entry}>• {entry}</li>) : <li>• None identified</li>}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Missing context</p>
                <ul className="mt-1 space-y-1 text-sm text-foreground-secondary">
                  {documentReview.missingContext.length ? documentReview.missingContext.map((entry) => <li key={entry}>• {entry}</li>) : <li>• None identified</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
        {loading && (
          <div className="flex flex-1 items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
            <p className="text-destructive text-center">{error}</p>
            <p className="text-sm text-foreground-muted text-center max-w-md">
              Ensure API is running on port 3001 and NEXT_PUBLIC_API_URL is set in apps/web/.env.local
            </p>
          </div>
        )}
        {blobUrl && !loading && (
          <iframe
            src={blobUrl}
            title={docName || 'Document'}
            className="w-full flex-1 min-h-[75vh] border-0 rounded bg-white"
          />
        )}
      </div>
    </Dialog>
  );
}
