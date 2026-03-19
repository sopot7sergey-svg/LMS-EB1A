'use client';

import { Check } from 'lucide-react';
import type { DocumentMetadata, DocumentReviewFinalStatus } from '@aipas/shared';

const STATUS_STYLES: Record<DocumentReviewFinalStatus, string> = {
  usable: 'border-violet-400/50 bg-violet-500/15 text-violet-200',
  weak: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
  irrelevant: 'border-slate-400/40 bg-slate-500/15 text-slate-200',
  needs_context: 'border-purple-400/40 bg-purple-500/15 text-purple-200',
};

export function isReviewArtifact(metadata?: DocumentMetadata | Record<string, unknown> | null): boolean {
  return Boolean(
    metadata &&
      typeof metadata === 'object' &&
      ((metadata as DocumentMetadata).reviewKind === 'document_review' ||
        (metadata as DocumentMetadata).reviewForDocumentId)
  );
}

export function hasDocumentReview(metadata?: DocumentMetadata | Record<string, unknown> | null): boolean {
  return Boolean(
    metadata &&
      typeof metadata === 'object' &&
      !isReviewArtifact(metadata) &&
      'documentReview' in metadata &&
      (metadata as DocumentMetadata).documentReview?.reviewedAt
  );
}

export function formatDocumentReviewStatus(status?: DocumentReviewFinalStatus | null): string {
  switch (status) {
    case 'usable':
      return 'Пригоден';
    case 'weak':
      return 'Слабый';
    case 'irrelevant':
      return 'Не релевантен';
    case 'needs_context':
      return 'Нужен контекст';
    default:
      return 'Проверено';
  }
}

export function DocumentReviewIndicator({
  metadata,
  className = '',
}: {
  metadata?: DocumentMetadata | Record<string, unknown> | null;
  className?: string;
}) {
  const review = (metadata as DocumentMetadata | undefined)?.documentReview;
  if (!review?.reviewedAt || isReviewArtifact(metadata)) return null;

  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-[4px] border ${STATUS_STYLES[review.finalStatus]} ${className}`}
      title={`Проверено агентом: ${formatDocumentReviewStatus(review.finalStatus)}`}
      aria-label={`Проверено агентом: ${formatDocumentReviewStatus(review.finalStatus)}`}
    >
      <Check className="h-3.5 w-3.5" />
    </span>
  );
}
