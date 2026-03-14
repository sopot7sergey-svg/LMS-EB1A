import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getAccess } from '../services/access';

const router = Router();
const prisma = new PrismaClient();

const PLANS = {
  start: {
    id: 'start',
    name: 'Start',
    description: 'Free 30-day app access after course purchase',
    price: null,
    priceAnnual: null,
    maxCases: 3,
    uploadEnabled: false,
    selfService: false,
    note: 'Granted automatically after course purchase',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Full app access for case building',
    price: 50,
    priceAnnual: 300,
    maxCases: 3,
    uploadEnabled: false,
    selfService: true,
    note: null,
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    description: 'Extended access with document upload',
    price: 100,
    priceAnnual: 900,
    maxCases: 5,
    uploadEnabled: true,
    selfService: false,
    note: 'By admin approval only. Contact support to request.',
  },
};

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const access = await getAccess(req.user!.id);
    const app = await prisma.appAccess.findUnique({
      where: { userId: req.user!.id },
    });
    const ultraRequest = await prisma.ultraEligibilityRequest.findFirst({
      where: { userId: req.user!.id },
      orderBy: { requestedAt: 'desc' },
    });

    res.json({
      plans: Object.values(PLANS),
      currentPlan: access.plan,
      planStatus: access.planStatus,
      proActive: access.plan === 'pro' && access.planStatus === 'active',
      ultraEligibilityRequest: ultraRequest
        ? { status: ultraRequest.status, requestedAt: ultraRequest.requestedAt }
        : null,
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

export default router;
