/**
 * Provider-agnostic billing interface.
 * Implementations: stripe-adapter, none (no-op).
 */

export type BillingPlan = 'pro' | 'ultra';
export type BillingCycle = 'monthly' | 'annual';

export interface CreateCheckoutSessionParams {
  userId: string;
  userEmail: string;
  plan: BillingPlan;
  billingCycle: BillingCycle;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutSessionResult {
  url: string;
  sessionId?: string;
}

export interface CreatePortalSessionParams {
  userId: string;
  returnUrl: string;
}

export interface CreatePortalSessionResult {
  url: string;
}

export interface WebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface BillingProvider {
  /** Create a checkout session for subscription. Returns redirect URL. */
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CreateCheckoutSessionResult>;

  /** Create a customer portal session for managing subscription. */
  createPortalSession(params: CreatePortalSessionParams): Promise<CreatePortalSessionResult>;

  /** Cancel subscription (immediate or at period end). */
  cancelSubscription(userId: string, atPeriodEnd?: boolean): Promise<void>;

  /** Process webhook payload. Returns parsed event or null if not handled. */
  syncFromWebhook(payload: string | Buffer, signature: string): Promise<WebhookEvent | null>;
}
