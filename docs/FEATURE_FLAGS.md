# Feature Flags

A simple environment-based mechanism for safe rollout of new features.

## Mechanism

- **Environment variables**: `FEATURE_<NAME>=1` to enable, unset or `0` to disable.
- **Default**: Features are **disabled** unless explicitly enabled.
- **Scope**: Application-wide. No per-user flags in v1 (can be added later if needed).

## Usage

```typescript
// In application code
const FEATURE_NEW_BUILDER = process.env.FEATURE_NEW_BUILDER === '1';

if (FEATURE_NEW_BUILDER) {
  // New behavior
} else {
  // Existing behavior
}
```

## Naming

- Use `FEATURE_` prefix.
- Use `SCREAMING_SNAKE_CASE`.
- Examples: `FEATURE_NEW_BUILDER`, `FEATURE_BETA_REVIEW_UI`, `FEATURE_ADVISOR_RAG`.

## Rules

1. **New features**: Default to disabled. Enable in staging first, then production when ready.
2. **Unfinished work**: Keep behind a flag until fully tested.
3. **Removal**: Once a feature is stable and always-on, remove the flag and the legacy path in a later release.

## Production

- Set flags in production `.env` or deployment config.
- Do not enable experimental features for all users without staging validation.
