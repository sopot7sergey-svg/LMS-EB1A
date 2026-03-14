import { Router } from 'express';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getAccess } from '../services/access';
import * as billingService from '../services/billing/service';

const router = Router();
const prisma = new PrismaClient();

/** GET /status - existing billing status */
router.get('/status', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const access = await getAccess(req.user!.id);
    const app = await prisma.appAccess.findUnique({
      where: { userId: req.user!.id },
    });
    const subscriptions = await prisma.subscriptionRecord.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    res.json({
      plan: access.plan,
      planStatus: access.planStatus,
      expiresAt: access.expiresAt,
      billingCycle: app?.billingCycle ?? null,
      autoRenew: app?.autoRenew ?? false,
      cancelAtPeriodEnd: app?.cancelAtPeriodEnd ?? false,
      maxCases: access.maxCases,
      caseCount: access.caseCount,
      uploadEnabled: access.uploadEnabled,
      subscriptions,
    });
  } catch (error) {
    console.error('Get billing status error:', error);
    res.status(500).json({ error: 'Failed to get billing status' });
  }
});

/** POST /checkout - create checkout session, returns { url } */
router.post('/checkout', authenticate, [
  body('plan').isIn(['pro', 'ultra']),
  body('billingCycle').isIn(['monthly', 'annual']),
], async (req: AuthRequest, res: express.Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { plan, billingCycle } = req.body;
    const result = await billingService.createCheckout(req.user!.id, plan, billingCycle);
    res.json(result);
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(400).json({ error: error?.message ?? 'Failed to create checkout' });
  }
});

/** POST /portal - create customer portal session, returns { url } */
router.post('/portal', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const result = await billingService.createPortal(req.user!.id);
    res.json(result);
  } catch (error: any) {
    console.error('Portal error:', error);
    res.status(400).json({ error: error?.message ?? 'Failed to create portal session' });
  }
});

/** POST /cancel - cancel subscription */
router.post('/cancel', authenticate, [
  body('reason').optional().trim(),
  body('atPeriodEnd').optional().isBoolean(),
], async (req: AuthRequest, res: express.Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { reason, atPeriodEnd = true } = req.body;
    await billingService.cancelSubscription(req.user!.id, atPeriodEnd, reason);
    res.json({ message: atPeriodEnd ? 'Subscription will cancel at period end' : 'Subscription canceled' });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    res.status(400).json({ error: error?.message ?? 'Failed to cancel subscription' });
  }
});

/** POST /webhook - Stripe webhook (raw body, no auth). Mount with express.raw() in index. */
export const webhookHandler = async (req: express.Request, res: express.Response): Promise<void> => {
  const signature = req.headers['stripe-signature'] as string | undefined;
  if (!signature) {
    res.status(400).json({ error: 'Missing stripe-signature' });
    return;
  }
  const payload = req.body;
  if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
    res.status(400).json({ error: 'Missing payload' });
    return;
  }
  try {
    await billingService.handleWebhook(payload, signature);
    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error?.message ?? 'Webhook failed' });
  }
};

export default router;
