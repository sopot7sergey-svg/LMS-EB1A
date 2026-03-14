/**
 * Simple environment-based feature flags for safe rollout.
 * See docs/FEATURE_FLAGS.md for usage.
 */

export function isFeatureEnabled(name: string): boolean {
  const key = `FEATURE_${name}`.toUpperCase().replace(/-/g, '_');
  return process.env[key] === '1';
}
