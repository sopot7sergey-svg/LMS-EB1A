/**
 * Stripe billing provider implementation.
 * Uses env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_*.
 */

import Stripe from 'stripe';
import type {
  BillingProvider,
  CreateCheckoutSessionParams,
  CreateCheckoutSessionResult,
  CreatePortalSessionParams,
  CreatePortalSessionResult,
  WebhookEvent,
} from './types';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_PRO_MONTHLY = process.env.STRIPE_PRICE_PRO_MONTHLY;
const STRIPE_PRICE_PRO_ANNUAL = process.env.STRIPE_PRICE_PRO_ANNUAL;
const STRIPE_PRICE_ULTRA_MONTHLY = process.env.STRIPE_PRICE_ULTRA_MONTHLY;
const STRIPE_PRICE_ULTRA_ANNUAL = process.env.STRIPE_PRICE_ULTRA_ANNUAL;

function getPriceId(plan: 'pro' | 'ultra', cycle: 'monthly' | 'annual'): string {
  if (plan === 'pro' && cycle === 'monthly') return STRIPE_PRICE_PRO_MONTHLY || '';
  if (plan === 'pro' && cycle === 'annual') return STRIPE_PRICE_PRO_ANNUAL || '';
  if (plan === 'ultra' && cycle === 'monthly') return STRIPE_PRICE_ULTRA_MONTHLY || '';
  if (plan === 'ultra' && cycle === 'annual') return STRIPE_PRICE_ULTRA_ANNUAL || '';
  throw new Error(`Unknown plan/cycle: ${plan}/${cycle}`);
}

export class StripeBillingProvider implements BillingProvider {
  private stripe: Stripe | null = null;

  private getStripe(): Stripe {
    if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    if (!this.stripe) this.stripe = new Stripe(STRIPE_SECRET_KEY);
    return this.stripe;
  }

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CreateCheckoutSessionResult> {
    const stripe = this.getStripe();
    const priceId = getPriceId(params.plan, params.billingCycle);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: params.userEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        userId: params.userId,
        plan: params.plan,
        billingCycle: params.billingCycle,
      },
      subscription_data: {
        metadata: { userId: params.userId, plan: params.plan, billingCycle: params.billingCycle },
      },
    });

    const url = session.url;
    if (!url) throw new Error('Stripe checkout session has no URL');
    return { url, sessionId: session.id ?? undefined };
  }

  async createPortalSession(params: CreatePortalSessionParams): Promise<CreatePortalSessionResult> {
    const stripe = this.getStripe();
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const record = await prisma.subscriptionRecord.findFirst({
      where: { userId: params.userId },
      orderBy: { createdAt: 'desc' },
    });
    const customerId = record?.externalCustomerId;
    if (!customerId) throw new Error('No billing customer found. Subscribe first.');

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: params.returnUrl,
    });

    return { url: session.url };
  }

  async cancelSubscription(userId: string, atPeriodEnd = true): Promise<void> {
    const stripe = this.getStripe();
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const app = await prisma.appAccess.findUnique({ where: { userId } });
    const subId = app?.providerSubscriptionId;
    if (!subId) throw new Error('No active subscription found');

    if (atPeriodEnd) {
      await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
    } else {
      await stripe.subscriptions.cancel(subId);
    }
  }

  async syncFromWebhook(payload: string | Buffer, signature: string): Promise<WebhookEvent | null> {
    if (!STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    const stripe = this.getStripe();

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      STRIPE_WEBHOOK_SECRET
    ) as Stripe.Event;

    const obj = (event.data as { object?: unknown })?.object;
    return {
      type: event.type,
      data: (obj ?? event.data) as Record<string, unknown>,
    };
  }
}
