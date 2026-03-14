import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { canAccessApp, getAccess } from '../services/access';
import { runCompile } from '../services/compile/compiler';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId } = req.params;
    const options = req.body || {};

    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }
    if (req.user!.role !== 'admin' && caseRecord.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user!.role !== 'admin') {
      const access = await getAccess(req.user!.id);
      if (!canAccessApp(access)) {
        return res.status(403).json({ error: 'App access expired. Renew your plan.' });
      }
    }

    const job = await prisma.compileJob.create({
      data: {
        caseId,
        status: 'pending',
        progress: 0,
        options: options as object,
      },
    });

    runCompile(job.id, caseId, options, async () => {}).catch((err) => {
      console.error('Compile job failed:', err);
    });

    res.status(202).json({
      jobId: job.id,
      status: job.status,
      message: 'Compilation started. Poll GET /cases/:caseId/compile/:jobId/status for progress.',
    });
  } catch (error) {
    console.error('Start compile error:', error);
    res.status(500).json({ error: 'Failed to start compilation' });
  }
});

router.get('/:jobId/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId, jobId } = req.params;

    const job = await prisma.compileJob.findUnique({
      where: { id: jobId },
      include: { artifact: true },
    });
    if (!job || job.caseId !== caseId) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) return res.status(404).json({ error: 'Case not found' });
    if (req.user!.role !== 'admin' && caseRecord.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user!.role !== 'admin') {
      const access = await getAccess(req.user!.id);
      if (!canAccessApp(access)) {
        return res.status(403).json({ error: 'App access expired. Renew your plan.' });
      }
    }

    res.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      error: job.error,
      artifactId: job.artifact?.id,
    });
  } catch (error) {
    console.error('Compile status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

router.get('/:jobId/download', authenticate, async (req: AuthRequest, res) => {
  try {
    const { caseId, jobId } = req.params;

    const job = await prisma.compileJob.findFirst({
      where: { id: jobId, caseId },
      include: { artifact: true },
    });
    if (!job || job.status !== 'completed' || !job.artifact) {
      return res.status(404).json({ error: 'Compilation not ready or not found' });
    }

    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) return res.status(404).json({ error: 'Case not found' });
    if (req.user!.role !== 'admin' && caseRecord.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user!.role !== 'admin') {
      const access = await getAccess(req.user!.id);
      if (!canAccessApp(access)) {
        return res.status(403).json({ error: 'App access expired. Renew your plan.' });
      }
    }

    const filePath = job.artifact.filePath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filename = `EB1A-Officer-Packet-${caseId.slice(0, 8)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Compile download error:', error);
    res.status(500).json({ error: 'Failed to download' });
  }
});

export default router;
