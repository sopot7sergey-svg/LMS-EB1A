import type { DocumentMetadata, DocumentReviewResult, DocumentReviewFinalStatus } from '@aipas/shared';
import { AIGateway } from '../ai/gateway';
import { MULTILINGUAL_RESPONSE_INSTRUCTION } from '../ai/prompts';
import type { DocumentExtractionResult } from './text-extraction';

interface ReviewableDocument {
  id: string;
  originalName: string;
  mimeType: string;
  category: string;
  metadata?: DocumentMetadata | null;
}

interface DocumentReviewInput {
  documents: ReviewableDocument[];
  extractions: DocumentExtractionResult[];
}

function splitFileName(originalName: string): { baseName: string; extension: string } {
  const trimmed = originalName.trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return { baseName: trimmed, extension: '' };
  }
  return {
    baseName: trimmed.slice(0, lastDot),
    extension: trimmed.slice(lastDot + 1),
  };
}

export function makeReviewDocumentName(originalName: string): string {
  const { baseName } = splitFileName(originalName);
  return `${baseName} — Review.txt`;
}

export function renderDocumentReviewReport(
  reviewedDocumentName: string,
  review: DocumentReviewResult
): string {
  const lines = [
    'Document Review Report',
    '',
    `Reviewed document: ${reviewedDocumentName}`,
    `Reviewed at: ${review.reviewedAt}`,
    `Reviewed by: Document Review agent`,
    `Document type: ${review.documentType}`,
    `Related criterion: ${review.relatedCriterion ?? 'Not identified'}`,
    `Related section: ${review.relatedSection ?? 'Not identified'}`,
    `Final status: ${review.finalStatus}`,
    '',
    'Strengths:',
    ...(review.strengths.length ? review.strengths.map((item) => `- ${item}`) : ['- None identified']),
    '',
    'Weaknesses:',
    ...(review.weaknesses.length ? review.weaknesses.map((item) => `- ${item}`) : ['- None identified']),
    '',
    'Missing context:',
    ...(review.missingContext.length ? review.missingContext.map((item) => `- ${item}`) : ['- None identified']),
  ];

  return `${lines.join('\n')}\n`;
}

function asFinalStatus(value: unknown): DocumentReviewFinalStatus | null {
  return typeof value === 'string' &&
    ['usable', 'weak', 'irrelevant', 'needs_context'].includes(value)
    ? (value as DocumentReviewFinalStatus)
    : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function inferCriterionFromSlot(slotType?: string | null): string | null {
  if (!slotType) return null;
  if (slotType.includes('award')) return 'C1';
  if (slotType.includes('membership')) return 'C2';
  if (slotType.includes('published') || slotType.includes('media')) return 'C3';
  if (slotType.includes('judging')) return 'C4';
  if (slotType.includes('contribution') || slotType.includes('patent') || slotType.includes('project')) return 'C5';
  if (slotType.includes('scholarly') || slotType.includes('publication')) return 'C6';
  if (slotType.includes('display') || slotType.includes('showcase') || slotType.includes('exhibition')) return 'C7';
  if (slotType.includes('leading') || slotType.includes('role')) return 'C8';
  if (slotType.includes('salary') || slotType.includes('pay') || slotType.includes('compensation')) return 'C9';
  if (slotType.includes('commercial')) return 'C10';
  return null;
}

function inferSection(document: ReviewableDocument): string | null {
  return document.metadata?.slotType ?? document.category ?? null;
}

function inferDocumentType(document: ReviewableDocument): string {
  const slotType = document.metadata?.slotType;
  if (slotType) {
    return slotType.replace(/_/g, ' ');
  }
  const lowerName = document.originalName.toLowerCase();
  if (lowerName.includes('resume') || lowerName.includes('cv')) return 'resume or CV';
  if (lowerName.includes('award')) return 'award evidence';
  if (lowerName.includes('letter')) return 'letter';
  if (lowerName.includes('passport')) return 'identity document';
  if (document.mimeType === 'application/pdf') return 'PDF document';
  if (document.mimeType.includes('word')) return 'Word document';
  if (document.mimeType === 'text/plain') return 'text document';
  return 'supporting document';
}

function buildFallbackReview(
  document: ReviewableDocument,
  extraction?: DocumentExtractionResult
): DocumentReviewResult {
  const slotType = document.metadata?.slotType;
  const relatedCriterion = inferCriterionFromSlot(slotType);
  const extractionFailed = !extraction?.extractionSucceeded;
  const appearsThin = extraction?.appearsScanned || (extraction?.extractedTextLength ?? 0) < 400;

  let finalStatus: DocumentReviewFinalStatus = 'needs_context';
  if (relatedCriterion || slotType) {
    finalStatus = extractionFailed || appearsThin ? 'needs_context' : 'usable';
  } else if (document.category === 'Evidence (Criteria)') {
    finalStatus = extractionFailed ? 'weak' : 'needs_context';
  } else if (document.category === 'Forms & Fees' || document.category === 'Identity & Status') {
    finalStatus = 'irrelevant';
  }

  const strengths = [
    `Document appears to belong to ${document.category}.`,
    slotType ? `Stored checklist slot: ${slotType}.` : '',
  ].filter(Boolean);

  const weaknesses = [
    extractionFailed ? 'The file did not yield reliable readable text for deeper review.' : '',
    !relatedCriterion ? 'The criterion relevance is not obvious from current metadata alone.' : '',
  ].filter(Boolean);

  const missingContext = [
    !slotType ? 'Link this file to the intended checklist slot or criterion.' : '',
    appearsThin ? 'Provide a clearer text-based copy, OCR, or a short explanation of what this document proves.' : '',
  ].filter(Boolean);

  return {
    reviewedAt: new Date().toISOString(),
    reviewedBy: 'document_review_agent',
    documentType: inferDocumentType(document),
    relatedCriterion,
    relatedSection: inferSection(document),
    strengths,
    weaknesses,
    missingContext,
    finalStatus,
  };
}

function hasUsableAiConfig(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return Boolean(key && key !== 'your-openai-api-key');
}

export async function reviewDocuments(
  input: DocumentReviewInput
): Promise<Array<{ documentId: string; review: DocumentReviewResult }>> {
  const extractionMap = new Map(input.extractions.map((item) => [item.documentId, item]));
  if (!hasUsableAiConfig()) {
    return input.documents.map((document) => ({
      documentId: document.id,
      review: buildFallbackReview(document, extractionMap.get(document.id)),
    }));
  }

  const aiGateway = new AIGateway();
  const reviews = await Promise.all(
    input.documents.map(async (document) => {
      const extraction = extractionMap.get(document.id);
      try {
        const result = await aiGateway.chatWithJSON<{
          documentType?: string;
          relatedCriterion?: string | null;
          relatedSection?: string | null;
          strengths?: string[];
          weaknesses?: string[];
          missingContext?: string[];
          finalStatus?: DocumentReviewFinalStatus;
        }>({
          systemPrompt: [
            'You are the Document Review agent for an EB-1A case workspace.',
            'Review one uploaded document and return JSON only.',
            'Classify the document, infer what criterion or section it relates to, identify strengths, weaknesses, and missing context, and give one finalStatus.',
            'Allowed finalStatus values: usable, weak, irrelevant, needs_context.',
            'Do not provide legal advice and do not claim approval.',
            MULTILINGUAL_RESPONSE_INSTRUCTION,
          ].join(' '),
          messages: [
            {
              role: 'user',
              content: JSON.stringify(
                {
                  document: {
                    originalName: document.originalName,
                    mimeType: document.mimeType,
                    category: document.category,
                    metadata: document.metadata ?? null,
                  },
                  extraction: extraction
                    ? {
                        extractedTextLength: extraction.extractedTextLength,
                        extractionSucceeded: extraction.extractionSucceeded,
                        appearsScanned: extraction.appearsScanned,
                        preview: extraction.preview,
                        extractedText: extraction.extractedText.slice(0, 12000),
                        failureReason: extraction.failureReason ?? null,
                      }
                    : null,
                },
                null,
                2
              ),
            },
          ],
          temperature: 0.2,
          maxTokens: 900,
        });

        const fallback = buildFallbackReview(document, extraction);
        return {
          documentId: document.id,
          review: {
            reviewedAt: new Date().toISOString(),
            reviewedBy: 'document_review_agent' as const,
            documentType:
              typeof result.documentType === 'string' && result.documentType.trim()
                ? result.documentType.trim()
                : fallback.documentType,
            relatedCriterion:
              typeof result.relatedCriterion === 'string' && result.relatedCriterion.trim()
                ? result.relatedCriterion.trim()
                : fallback.relatedCriterion,
            relatedSection:
              typeof result.relatedSection === 'string' && result.relatedSection.trim()
                ? result.relatedSection.trim()
                : fallback.relatedSection,
            strengths: normalizeStringArray(result.strengths).length
              ? normalizeStringArray(result.strengths)
              : fallback.strengths,
            weaknesses: normalizeStringArray(result.weaknesses).length
              ? normalizeStringArray(result.weaknesses)
              : fallback.weaknesses,
            missingContext: normalizeStringArray(result.missingContext).length
              ? normalizeStringArray(result.missingContext)
              : fallback.missingContext,
            finalStatus: asFinalStatus(result.finalStatus) ?? fallback.finalStatus,
          },
        };
      } catch (error) {
        console.error('Document review AI failed, using fallback review:', error);
        return {
          documentId: document.id,
          review: buildFallbackReview(document, extraction),
        };
      }
    })
  );

  return reviews;
}
