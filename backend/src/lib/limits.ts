// Input limits (ONBOARDING_SECURITY_PLAN.md Phase 6). The frontend's copies are in
// shared/src/enums.ts — the backend build does not bundle @anlet/shared, so it can only import
// types from there (same reason hvsGroups.ts exists on both sides). Keep the two in step.
// New passwords only: signing in with an existing shorter one keeps working.
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;
export const MAX_COMMENT_LENGTH = 5000;
export const MAX_NAME_LENGTH = 100;
