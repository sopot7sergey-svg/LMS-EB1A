import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';

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
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId, category } = req.query;

    const where: any = { userId: req.user!.id };
    if (caseId) where.caseId = caseId;
    if (category) where.category = category;

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

router.post('/', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { caseId, category } = req.body;

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

    const filename = `${uuidv4()}-${req.file.originalname}`;
    const s3Key = `documents/${caseId}/${filename}`;

    const document = await prisma.document.create({
      data: {
        caseId,
        userId: req.user!.id,
        filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        category: category || 'misc',
        s3Key,
      },
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
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

    res.json(document);
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

    const updated = await prisma.document.update({
      where: { id },
      data: {
        ...(category && { category }),
        ...(metadata && { metadata }),
      },
    });

    res.json(updated);
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

    await prisma.document.delete({ where: { id } });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
