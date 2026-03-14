import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { canUpload, getAccess } from '../services/access';
import { getDocumentBuilderConfig, normalizeCategory, type DocumentMetadataSource } from '@aipas/shared';
import {
  deleteStoredDocumentFile,
  ensureCaseDocumentDir,
  getCanonicalDocumentPath,
  resolveStoredDocumentPath,
} from '../services/documents/storage';

const router = Router();
const prisma = new PrismaClient();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

function deriveBuilderStatusAfterSourceRemoval(state: {
  status: string;
  progress: number;
  sourceDocumentIds: string[];
  draftJson: unknown;
  draftText: string | null;
}) {
  const hasSources = state.sourceDocumentIds.length > 0;
  const hasDraft =
    Boolean(state.draftText?.trim()) ||
    (typeof state.draftJson === 'object' && state.draftJson !== null);

  if (state.status === 'completed') {
    return { status: 'completed', progress: Math.max(state.progress, 100) };
  }
  if (state.status === 'created' && hasDraft) {
    return { status: 'in_progress', progress: Math.min(Math.max(state.progress, 70), 89) };
  }
  if (hasDraft) {
    return { status: 'in_progress', progress: Math.max(state.progress, 70) };
  }
  if (hasSources) {
    return { status: 'added', progress: Math.max(Math.min(state.progress, 55), 25) };
  }
  return { status: 'not_started', progress: 0 };
}

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId, category } = req.query;

    const where: any = { userId: req.user!.id };
    if (caseId) where.caseId = caseId;
    if (category && typeof category === 'string') {
      where.category = normalizeCategory(category);
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Normalize category on response for any legacy values still in DB
    const normalized = documents.map((d) => ({
      ...d,
      category: normalizeCategory(d.category),
    }));

    res.json(normalized);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

router.post('/', authenticate, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.message === 'Invalid file type') {
        return res.status(400).json({ error: 'Invalid file type. Use PDF, JPG, PNG, GIF, DOC, DOCX, or TXT.' });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
      }
      return res.status(500).json({ error: err.message || 'Upload failed' });
    }
    next();
  });
}, async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (req.user!.role !== 'admin') {
      const access = await getAccess(req.user!.id);
      if (!canUpload(access)) {
        return res.status(403).json({
          error: 'Document upload is not enabled for your account. Upgrade to Ultra or contact admin.',
        });
      }
    }

    const { caseId, category, builderStateId, source } = req.body;

    if (!caseId) {
      return res.status(400).json({ error: 'Case ID is required' });
    }

    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (req.user!.role !== 'admin' && caseRecord.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const builderConfig = typeof category === 'string' ? getDocumentBuilderConfig(category) : undefined;
    if (builderConfig && !builderConfig.acceptedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: `Unsupported file type for ${builderConfig.shortLabel}. Allowed types: ${builderConfig.acceptedMimeTypes.join(', ')}`,
      });
    }

    const filename = `${uuidv4()}-${req.file.originalname}`;
    const s3Key = `documents/${caseId}/${filename}`;

    ensureCaseDocumentDir(caseId);
    const filePath = getCanonicalDocumentPath(caseId, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    // Normalize category: legacy values, slotTypes, or new categories -> valid document category
    const normalizedCategory = normalizeCategory(category);
    const metadata = category
      ? {
          slotType: category,
          ...(builderStateId ? { builderStateId } : {}),
          ...(source ? { source: source as DocumentMetadataSource } : {}),
        }
      : undefined;

    const document = await prisma.document.create({
      data: {
        caseId,
        userId: caseRecord.userId,
        filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size as number,
        category: normalizedCategory,
        metadata: metadata || undefined,
        s3Key,
      },
    });

    if (builderStateId && typeof builderStateId === 'string') {
      const existing = await prisma.documentBuilderState.findUnique({
        where: { id: builderStateId },
      });

      if (existing && existing.caseId === caseId) {
        const sourceDocumentIds = Array.from(new Set([...(existing.sourceDocumentIds || []), document.id]));
        await prisma.documentBuilderState.update({
          where: { id: builderStateId },
          data: {
            sourceDocumentIds,
            status: existing.status === 'not_started' ? 'added' : existing.status,
            progress: Math.max(existing.progress, 25),
          },
        });
      }
    }

    res.status(201).json(document);
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

router.get('/:id/file', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: { case: { select: { userId: true } } },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (req.user!.role !== 'admin' && document.case.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { resolvedPath, attemptedPaths } = resolveStoredDocumentPath(document);
    if (!resolvedPath) {
      console.error('Document file not found:', {
        id,
        s3Key: document.s3Key,
        caseId: document.caseId,
        filename: document.filename,
        cwd: process.cwd(),
        attemptedPaths,
      });
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalName)}"`);
    res.sendFile(resolvedPath);
  } catch (error) {
    console.error('Get document file error:', error);
    res.status(500).json({ error: 'Failed to get file' });
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: { case: { select: { userId: true } } },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (req.user!.role !== 'admin' && document.case.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      ...document,
      category: normalizeCategory(document.category),
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { category, metadata } = req.body;

    const document = await prisma.document.findUnique({
      where: { id },
      include: { case: { select: { userId: true } } },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (req.user!.role !== 'admin' && document.case.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData: { category?: string; metadata?: object } = {};
    if (category) updateData.category = normalizeCategory(category);
    if (metadata) updateData.metadata = metadata;

    const updated = await prisma.document.update({
      where: { id },
      data: updateData,
    });

    res.json({
      ...updated,
      category: normalizeCategory(updated.category),
    });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: { case: { select: { userId: true } } },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (req.user!.role !== 'admin' && document.case.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    try {
      deleteStoredDocumentFile(document);
    } catch (e) {
      console.warn('Could not delete file for document:', document.id, e);
    }

    const builderStates = await prisma.documentBuilderState.findMany({
      where: {
        caseId: document.caseId,
        sourceDocumentIds: {
          has: id,
        },
      },
      select: {
        id: true,
        sourceDocumentIds: true,
        status: true,
        progress: true,
        draftJson: true,
        draftText: true,
      },
    });

    for (const state of builderStates) {
      const nextSourceIds = state.sourceDocumentIds.filter((docId) => docId !== id);
      const fallback = deriveBuilderStatusAfterSourceRemoval({
        status: state.status,
        progress: state.progress,
        sourceDocumentIds: nextSourceIds,
        draftJson: state.draftJson,
        draftText: state.draftText,
      });
      await prisma.documentBuilderState.update({
        where: { id: state.id },
        data: {
          sourceDocumentIds: nextSourceIds,
          status: fallback.status,
          progress: fallback.progress,
        },
      });
    }

    const metadata = (document.metadata ?? {}) as {
      builderStateId?: string;
      source?: DocumentMetadataSource;
    };
    if (metadata.builderStateId && metadata.source === 'generated') {
      const state = await prisma.documentBuilderState.findUnique({
        where: { id: metadata.builderStateId },
        select: {
          id: true,
          sourceDocumentIds: true,
          status: true,
          progress: true,
          draftJson: true,
          draftText: true,
        },
      });
      if (state) {
        const fallback = deriveBuilderStatusAfterSourceRemoval({
          status: state.status,
          progress: state.progress,
          sourceDocumentIds: state.sourceDocumentIds,
          draftJson: state.draftJson,
          draftText: state.draftText,
        });
        await prisma.documentBuilderState.update({
          where: { id: state.id },
          data: {
            status: fallback.status,
            progress: fallback.progress,
          },
        });
      }
    }

    await prisma.document.delete({ where: { id } });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
