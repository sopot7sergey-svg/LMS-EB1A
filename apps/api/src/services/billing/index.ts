/**
 * Billing provider factory.
 * Reads BILLING_PROVIDER env: stripe | none
 */

import type { BillingProvider } from './types';

let _provider: BillingProvider | null = null;

export function getBillingProvider(): BillingProvider | null {
  if (_provider !== null) return _provider;

  const providerName = (process.env.BILLING_PROVIDER || 'none').toLowerCase();

  if (providerName === 'stripe') {
    const { StripeBillingProvider } = require('./stripe-adapter');
    _provider = new StripeBillingProvider();
    return _provider;
  }

  // none: no-op provider (returns null from factory; callers handle)
  _provider = null;
  return null;
}
