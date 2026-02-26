import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const where = req.user!.role === 'admin' ? {} : { userId: req.user!.id };

    const cases = await prisma.case.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        workspace: true,
        _count: {
          select: {
            evidencePacks: true,
            letters: true,
            eers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(cases);
  } catch (error) {
    console.error('Get cases error:', error);
    res.status(500).json({ error: 'Failed to get cases' });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const caseRecord = await prisma.case.create({
      data: {
        userId: req.user!.id,
        status: 'draft',
        criteriaSelected: [],
        keywords: [],
      },
      include: { workspace: true },
    });

    await prisma.caseWorkspace.create({
      data: {
        caseId: caseRecord.id,
        folderStructure: {
          exhibits: [],
          letters: [],
          drafts: [],
        },
      },
    });

    const updatedCase = await prisma.case.findUnique({
      where: { id: caseRecord.id },
      include: { workspace: true },
    });

    res.status(201).json(updatedCase);
  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const caseRecord = await prisma.case.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        workspace: true,
        criteriaMatrix: { orderBy: { version: 'desc' }, take: 1 },
        evidencePacks: true,
        letters: true,
        petitionPackages: { orderBy: { version: 'desc' }, take: 1 },
        eers: { orderBy: { version: 'desc' } },
        documents: true,
      },
    });

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (req.user!.role !== 'admin' && caseRecord.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(caseRecord);
  } catch (error) {
    console.error('Get case error:', error);
    res.status(500).json({ error: 'Failed to get case' });
  }
});

router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { caseAxisStatement, proposedEndeavor, keywords, criteriaSelected, status } = req.body;

    const existingCase = await prisma.case.findUnique({ where: { id } });
    if (!existingCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (req.user!.role !== 'admin' && existingCase.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedCase = await prisma.case.update({
      where: { id },
      data: {
        ...(caseAxisStatement !== undefined && { caseAxisStatement }),
        ...(proposedEndeavor !== undefined && { proposedEndeavor }),
        ...(keywords !== undefined && { keywords }),
        ...(criteriaSelected !== undefined && { criteriaSelected }),
        ...(status !== undefined && { status }),
      },
      include: { workspace: true },
    });

    res.json(updatedCase);
  } catch (error) {
    console.error('Update case error:', error);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingCase = await prisma.case.findUnique({ where: { id } });
    if (!existingCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (req.user!.role !== 'admin' && existingCase.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.case.delete({ where: { id } });

    res.json({ message: 'Case deleted successfully' });
  } catch (error) {
    console.error('Delete case error:', error);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

export default router;
