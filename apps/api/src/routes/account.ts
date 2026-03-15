import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getAccess, registerDevice } from '../services/access';
import { getUsageSummary } from '../services/ai/quota';

const router = Router();
const prisma = new PrismaClient();

/** POST /request-ultra - create UltraEligibilityRequest (status pending) */
router.post('/request-ultra', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const existing = await prisma.ultraEligibilityRequest.findFirst({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
    });
    if (existing && existing.status === 'pending') {
      return res.status(400).json({ error: 'You already have a pending Ultra request' });
    }
    const request = await prisma.ultraEligibilityRequest.create({
      data: { userId, status: 'pending' },
    });
    res.status(201).json({ id: request.id, status: request.status });
  } catch (error) {
    console.error('Request Ultra error:', error);
    res.status(500).json({ error: 'Failed to submit Ultra request' });
  }
});

router.get('/access', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const access = await getAccess(req.user!.id);
    res.json(access);
  } catch (error) {
    console.error('Get access error:', error);
    res.status(500).json({ error: 'Failed to get access' });
  }
});

router.get('/usage', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const access = await getAccess(req.user!.id);
    const usage = await getUsageSummary(req.user!.id, access.plan as any);
    res.json(usage);
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

router.post('/device', authenticate, [
  body('deviceId').notEmpty().trim(),
  body('label').optional().trim(),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { deviceId, label } = req.body;
    const result = await registerDevice(req.user!.id, deviceId, label);
    if (!result.allowed) {
      return res.status(403).json({ error: result.message ?? 'Device limit reached' });
    }
    res.json({ message: 'Device registered' });
  } catch (error) {
    console.error('Register device error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

router.patch('/password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashed },
    });
    res.json({ message: 'Password updated' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
