import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { runPacketReview } from '../services/packet-review/reviewer';

const router = Router();
const prisma = new PrismaClient();

function getUserId(req: any): string | null {
  return (req as any).user?.userId ?? null;
}

function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const jwt = require('jsonwebtoken');
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

router.use(authMiddleware);

router.get('/cases/:caseId/packet-review/latest-compile', async (req, res) => {
  try {
    const { caseId } = req.params;
    const job = await prisma.compileJob.findFirst({
      where: { caseId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });
    res.json({ compileJobId: job?.id ?? null, compiledAt: job?.createdAt ?? null });
  } catch (error) {
    console.error('[PacketReview] latest-compile error:', error);
    res.status(500).json({ error: 'Failed to fetch latest compile job' });
  }
});

router.post('/cases/:caseId/packet-review', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { compileJobId } = req.body;

    if (!compileJobId) {
      return res.status(400).json({ error: 'compileJobId is required' });
    }

    const caseRecord = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const job = await prisma.compileJob.findUnique({ where: { id: compileJobId } });
    if (!job || job.caseId !== caseId) {
      return res.status(404).json({ error: 'Compile job not found for this case' });
    }
    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Compile job has not completed yet' });
    }

    const report = await runPacketReview(caseId, compileJobId);

    const artifact = await prisma.compileArtifact.findUnique({ where: { jobId: compileJobId } });
    if (artifact) {
      const existing = artifact.optionsHash ? JSON.parse(artifact.optionsHash) : {};
      existing.reviewedAt = new Date().toISOString();
      existing.lastAuditRiskLevel = report.executiveConclusion?.riskLevel ?? null;
      existing.savedAuditReport = report;
      await prisma.compileArtifact.update({
        where: { id: artifact.id },
        data: { optionsHash: JSON.stringify(existing) },
      });
    }

    res.json({ report });
  } catch (error) {
    console.error('[PacketReview] Error:', error);
    const message = error instanceof Error ? error.message : 'Packet review failed';
    res.status(500).json({ error: message });
  }
});

router.get('/cases/:caseId/packet-review/:jobId/report', async (req, res) => {
  try {
    const { caseId, jobId } = req.params;

    const artifact = await prisma.compileArtifact.findUnique({ where: { jobId } });
    if (!artifact) {
      return res.status(404).json({ error: 'No compiled artifact found for this job' });
    }

    const meta = artifact.optionsHash ? JSON.parse(artifact.optionsHash) : {};
    if (!meta.savedAuditReport) {
      return res.status(404).json({ error: 'No saved audit report found for this packet. Run an audit first.' });
    }

    res.json({ report: meta.savedAuditReport });
  } catch (error) {
    console.error('[PacketReview] get report error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit report' });
  }
});

export default router;
