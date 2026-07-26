export const ROLES = ['NORMAL_USER', 'EXECUTIVE', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ANSWER_OPTIONS = ['A', 'B', 'C', 'D'] as const;
export type AnswerOption = (typeof ANSWER_OPTIONS)[number];

// Sub-scenario identities are questionnaire-specific (RAN FM's 5 codes, Core FM's 2, Core
// Stability's single synthetic "OVERALL"), not a fixed global set — see schema.prisma's
// SubScenario.code comment. Plain string, not a union of literals.
export type SubScenarioCode = string;
