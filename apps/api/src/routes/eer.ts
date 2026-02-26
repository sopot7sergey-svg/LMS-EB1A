import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { EEROrchestrator } from '../services/ai/eer-orchestrator';

const router = Router();
const prisma = new PrismaClient();
const eerOrchestrator = new EEROrchestrator();

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
