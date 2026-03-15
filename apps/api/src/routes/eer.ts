import { Router } from 'express';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getAccess } from '../services/access';
import { checkQuota, recordUsage } from '../services/ai/quota';
import { EEROrchestrator } from '../services/ai/eer-orchestrator';
import {
  makeReviewDocumentName,
  renderDocumentReviewReport,
  reviewDocuments,
} from '../services/documents/document-review';
import { extractDocumentTextDetailed } from '../services/documents/text-extraction';
import {
  ensureCaseDocumentDir,
  getCanonicalDocumentPath,
} from '../services/documents/storage';
import type { DocumentMetadata } from '@aipas/shared';

const router = Router();
const prisma = new PrismaClient();
const eerOrchestrator = new EEROrchestrator();

function resolveReviewArtifactSlotType(
  existingMetadata: DocumentMetadata,
  review: { relatedSection?: string | null }
): string | undefined {
  const rawSlotType = existingMetadata.slotType?.trim();
  if (rawSlotType && rawSlotType.includes('_')) {
    return rawSlotType;
  }

  const relatedSection = review.relatedSection?.trim();
  if (relatedSection && relatedSection.includes('_')) {
    return relatedSection;
  }

  return rawSlotType || relatedSection || undefined;
}

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId } = req.query;

    if (!caseId) {
      return res.status(400).json({ error: 'Case ID is required' });
    }

    const caseRecord = await prisma.case.findUnique({ where: { id: caseId as string } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (req.user!.role !== 'admin' && caseRecord.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const eers = await prisma.eER.findMany({
      where: { caseId: caseId as string },
      orderBy: { version: 'desc' },
      include: {
        resolutions: true,
      },
    });

    res.json(eers);
  } catch (error) {
    console.error('Get EERs error:', error);
    res.status(500).json({ error: 'Failed to get EERs' });
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const eer = await prisma.eER.findUnique({
      where: { id },
      include: {
        case: { select: { userId: true } },
        resolutions: true,
      },
    });

    if (!eer) {
      return res.status(404).json({ error: 'EER not found' });
    }

    if (req.user!.role !== 'admin' && eer.case.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(eer);
  } catch (error) {
    console.error('Get EER error:', error);
    res.status(500).json({ error: 'Failed to get EER' });
  }
});

router.post('/review-documents', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId, documentIds } = req.body;
    if (!caseId || !documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'caseId and documentIds (non-empty array) are required' });
    }

    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) return res.status(404).json({ error: 'Case not found' });
    if (req.user!.role !== 'admin' && caseRecord.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userId = caseRecord.userId;
    const access = await getAccess(userId);
    const quotaCheck = await checkQuota(userId, 'document_review', access.plan as any, access.appAccessActive, {
      increment: documentIds.length,
    });
    if (!quotaCheck.allowed) {
      return res.status(403).json({ error: quotaCheck.message ?? 'Document review limit reached' });
    }

    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds }, caseId },
    });
    if (documents.length === 0) return res.status(404).json({ error: 'No matching documents found' });

    const extractions = await Promise.all(
      documents.map((document) =>
        extractDocumentTextDetailed({
          id: document.id,
          originalName: document.originalName,
          filename: document.filename,
          mimeType: document.mimeType,
          caseId: document.caseId,
        })
      )
    );

    const reviews = await reviewDocuments({
      documents: documents.map((document) => ({
        id: document.id,
        originalName: document.originalName,
        mimeType: document.mimeType,
        category: document.category,
        metadata: (document.metadata as DocumentMetadata | null) ?? null,
      })),
      extractions,
    });

    const persistedReviews = await Promise.all(
      reviews.map(async ({ documentId, review }) => {
        const document = documents.find((item) => item.id === documentId);
        if (!document) {
          return {
            documentId,
            originalName: documentId,
            category: null,
            review,
            reviewDocumentId: null,
            reviewDocumentName: null,
          };
        }

        const existingMetadata = ((document.metadata as DocumentMetadata | null) ?? {}) as DocumentMetadata;
        const isReviewArtifact = existingMetadata.reviewKind === 'document_review' || Boolean(existingMetadata.reviewForDocumentId);

        if (isReviewArtifact) {
          return {
            documentId,
            originalName: document.originalName,
            category: document.category,
            review,
            reviewDocumentId: null,
            reviewDocumentName: null,
          };
        }

        const reportText = renderDocumentReviewReport(document.originalName, review);
        const reviewOriginalName = makeReviewDocumentName(document.originalName);
        const reviewStoredFilename = `${randomUUID()}-${reviewOriginalName}`;
        const reviewSlotType = resolveReviewArtifactSlotType(existingMetadata, review);

        ensureCaseDocumentDir(caseId);
        fs.writeFileSync(getCanonicalDocumentPath(caseId, reviewStoredFilename), reportText, 'utf8');
        const siblingDocuments = await prisma.document.findMany({
          where: { caseId },
          orderBy: { createdAt: 'desc' },
        });
        const priorReviewArtifact = siblingDocuments.find((candidate) => {
          const metadata = (candidate.metadata as DocumentMetadata | null) ?? null;
          return metadata?.reviewKind === 'document_review' && metadata.reviewForDocumentId === document.id;
        });

        let createdReviewDocument;
        if (priorReviewArtifact) {
          try {
            fs.unlinkSync(getCanonicalDocumentPath(caseId, priorReviewArtifact.filename));
          } catch {
            // Best effort only; replacement file is written below.
          }

          createdReviewDocument = await prisma.document.update({
            where: { id: priorReviewArtifact.id },
            data: {
              filename: reviewStoredFilename,
              originalName: reviewOriginalName,
              mimeType: 'text/plain',
              size: Buffer.byteLength(reportText, 'utf8'),
              category: document.category,
              metadata: ({
                slotType: reviewSlotType,
                source: 'generated',
                builderStateId: existingMetadata.builderStateId,
                reviewKind: 'document_review',
                reviewForDocumentId: document.id,
              } as unknown) as Prisma.InputJsonValue,
              s3Key: `documents/${caseId}/${reviewStoredFilename}`,
            },
          });
        } else {
          createdReviewDocument = await prisma.document.create({
            data: {
              caseId,
              userId: caseRecord.userId,
              filename: reviewStoredFilename,
              originalName: reviewOriginalName,
              mimeType: 'text/plain',
              size: Buffer.byteLength(reportText, 'utf8'),
              category: document.category,
              metadata: ({
                slotType: reviewSlotType,
                source: 'generated',
                builderStateId: existingMetadata.builderStateId,
                reviewKind: 'document_review',
                reviewForDocumentId: document.id,
              } as unknown) as Prisma.InputJsonValue,
              s3Key: `documents/${caseId}/${reviewStoredFilename}`,
            },
          });
        }

        const persistedReview = {
          ...review,
          reviewDocumentId: createdReviewDocument.id,
        };

        await prisma.document.update({
          where: { id: documentId },
          data: {
            metadata: ({
              ...existingMetadata,
              documentReview: persistedReview,
            } as unknown) as Prisma.InputJsonValue,
          },
        });

        return {
          documentId,
          originalName: document.originalName,
          category: document.category,
          review: persistedReview,
          reviewDocumentId: createdReviewDocument.id,
          reviewDocumentName: createdReviewDocument.originalName,
        };
      })
    );

    const hasAI = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key');
    if (hasAI && documents.length > 0) {
      const model = process.env.OPENAI_MODEL || 'gpt-4o';
      for (let i = 0; i < documents.length; i++) {
        try {
          await recordUsage(userId, 'document_review', model, 1000, 400);
        } catch (err) {
          console.error('[EER] Failed to record document review usage:', err);
        }
      }
    }

    res.status(201).json({ reviews: persistedReviews });
  } catch (error) {
    console.error('Review documents error:', error);
    res.status(500).json({ error: 'Failed to review documents' });
  }
});

router.post('/generate', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId, claimedCriteria } = req.body;

    if (!caseId || !claimedCriteria || !Array.isArray(claimedCriteria)) {
      return res.status(400).json({ error: 'Case ID and claimed criteria are required' });
    }

    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        documents: true,
        letters: true,
        evidencePacks: true,
        petitionPackages: { orderBy: { version: 'desc' }, take: 1 },
        eers: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (req.user!.role !== 'admin' && caseRecord.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const newVersion = (caseRecord.eers[0]?.version || 0) + 1;

    const eerResult = await eerOrchestrator.generateEER({
      caseData: caseRecord,
      claimedCriteria,
      documents: caseRecord.documents,
      letters: caseRecord.letters,
      evidencePacks: caseRecord.evidencePacks,
      petitionPackage: caseRecord.petitionPackages[0],
    });

    const eer = await prisma.eER.create({
      data: {
        caseId,
        version: newVersion,
        executiveSummary: eerResult.executiveSummary,
        items: eerResult.items,
        criterionItems: eerResult.criterionItems,
        finalMeritsItems: eerResult.finalMeritsItems,
        optionalPackagingItems: eerResult.optionalPackagingItems,
      },
    });

    res.status(201).json(eer);
  } catch (error) {
    console.error('Generate EER error:', error);
    res.status(500).json({ error: 'Failed to generate EER' });
  }
});

router.post('/:id/resolve', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { changes, resolutionNotes } = req.body;

    const eer = await prisma.eER.findUnique({
      where: { id },
      include: { case: { select: { userId: true } } },
    });

    if (!eer) {
      return res.status(404).json({ error: 'EER not found' });
    }

    if (req.user!.role !== 'admin' && eer.case.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.eERResolution.create({
      data: {
        eerId: id,
        previousVersion: eer.version,
        changes: changes || [],
      },
    });

    const updatedEer = await prisma.eER.update({
      where: { id },
      data: { resolutionNotes },
    });

    res.json(updatedEer);
  } catch (error) {
    console.error('Resolve EER error:', error);
    res.status(500).json({ error: 'Failed to resolve EER' });
  }
});

export default router;
