export const ROLES = ['NORMAL_USER', 'EXECUTIVE', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ANSWER_OPTIONS = ['A', 'B', 'C', 'D'] as const;
export type AnswerOption = (typeof ANSWER_OPTIONS)[number];

export const SUB_SCENARIO_CODES = [
  'EQUIPMENT',
  'PROCESSING_ERROR',
  'COMMUNICATIONS',
  'ENVIRONMENTAL',
  'SECURITY',
] as const;
export type SubScenarioCode = (typeof SUB_SCENARIO_CODES)[number];
