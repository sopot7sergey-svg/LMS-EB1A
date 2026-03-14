/**
 * Billing service: orchestrates provider + Prisma.
 * createCheckout, createPortal, cancelSubscription, handleWebhook.
 */

import { PrismaClient } from '@prisma/client';
import { getBillingProvider } from './index';
import { syncSubscriptionFromProvider } from '../access';
import type { BillingPlan, BillingCycle } from './types';

const prisma = new PrismaClient();

export async function createCheckout(
  userId: string,
  plan: BillingPlan,
  billingCycle: BillingCycle
): Promise<{ url: string }> {
  if (plan === 'ultra') throw new Error('Ultra plan requires admin approval. Use Request Ultra.');
  const provider = getBillingProvider();
  if (!provider) throw new Error('Billing is not configured');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const successUrl = process.env.BILLING_SUCCESS_URL || 'http://localhost:3000/account/billing?success=1';
  const cancelUrl = process.env.BILLING_CANCEL_URL || 'http://localhost:3000/account/plans';

  const result = await provider.createCheckoutSession({
    userId,
    userEmail: user.email,
    plan,
    billingCycle,
    successUrl,
    cancelUrl,
  });

  return { url: result.url };
}

export async function createPortal(userId: string): Promise<{ url: string }> {
  const provider = getBillingProvider();
  if (!provider) throw new Error('Billing is not configured');

  const returnUrl = process.env.BILLING_SUCCESS_URL || 'http://localhost:3000/account/billing';

  const result = await provider.createPortalSession({
    userId,
    returnUrl,
  });

  return { url: result.url };
}

export async function cancelSubscription(userId: string, atPeriodEnd = true, reason?: string): Promise<void> {
  const app = await prisma.appAccess.findUnique({ where: { userId } });
  if (!app) throw new Error('No subscription found');

  const provider = getBillingProvider();
  if (provider && app.providerSubscriptionId) {
    await provider.cancelSubscription(userId, atPeriodEnd);
  }

  await prisma.$transaction(async (tx) => {
    const app = await tx.appAccess.findUnique({ where: { userId } });
    if (!app) return;

    if (atPeriodEnd) {
      await tx.appAccess.update({
        where: { userId },
        data: { cancelAtPeriodEnd: true },
      });
    } else {
      await tx.appAccess.update({
        where: { userId },
        data: {
          status: 'canceled',
          autoRenew: false,
          cancelAtPeriodEnd: false,
        },
      });
    }

    if (!atPeriodEnd) {
      await tx.subscriptionRecord.updateMany({
        where: { userId },
        data: { status: 'canceled', canceledAt: new Date() },
      });
    }
  });
}

export async function handleWebhook(payload: string | Buffer, signature: string): Promise<void> {
  const provider = getBillingProvider();
  if (!provider) throw new Error('Billing is not configured');

  const event = await provider.syncFromWebhook(payload, signature);
  if (!event) return;

  await syncSubscriptionFromProvider(event.type, event.data);
}
