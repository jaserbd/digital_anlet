// PROJECT_ADMIN is a membership role only (PROJECTS_PLAN.md); ADMIN is the global Application Admin.
export const ROLES = ['NORMAL_USER', 'EXECUTIVE', 'ADMIN', 'PROJECT_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ANSWER_OPTIONS = ['A', 'B', 'C', 'D'] as const;
export type AnswerOption = (typeof ANSWER_OPTIONS)[number];

// Sub-scenario identities are questionnaire-specific (RAN FM's 5 codes, Core FM's 2, Core
// Stability's single synthetic "OVERALL"), not a fixed global set — see schema.prisma's
// SubScenario.code comment. Plain string, not a union of literals.
export type SubScenarioCode = string;

// Input limits for the frontend (ONBOARDING_SECURITY_PLAN.md Phase 6); the backend enforces its own
// copies in backend/src/lib/limits.ts — keep the two in step. New passwords only: signing in with
// an existing shorter one keeps working.
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;
export const MAX_COMMENT_LENGTH = 5000;
export const MAX_NAME_LENGTH = 100;
