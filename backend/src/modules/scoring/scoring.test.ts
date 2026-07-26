import { describe, expect, it } from 'vitest';
import {
  computeScoreResult,
  type ScoringAnswerInput,
  type ScoringQuestionInput,
  type ScoringSubScenarioInput,
} from './scoring';

// The 8 RAN Fault Management questions, verified field-for-field against RAN_FM.xlsx's
// `Scoring` sheet (weights sum to 1; criteria are option A-D's numeric scores; A is
// always the top-scoring option). See CLAUDE.md "Domain model" for the source.
const RAN_FM_QUESTIONS: ScoringQuestionInput[] = [
  {
    id: 'intent',
    weight: 0.1,
    optionCriteria: { A: 4, B: 3, C: 0 },
    includeInE2ECheck: false, // Intent is excluded from the E2E checklist
  },
  {
    id: 'data-collection',
    weight: 0.1,
    optionCriteria: { A: 3, B: 2, C: 1, D: 0 },
    includeInE2ECheck: true,
  },
  {
    id: 'fault-prediction',
    weight: 0.15,
    optionCriteria: { A: 4, B: 3, C: 2, D: 0 },
    includeInE2ECheck: true,
  },
  {
    id: 'fault-identification',
    weight: 0.2,
    optionCriteria: { A: 3, B: 2, C: 0 },
    includeInE2ECheck: true,
  },
  {
    id: 'demarcation',
    weight: 0.2,
    optionCriteria: { A: 4, B: 3, C: 2, D: 0 },
    includeInE2ECheck: true,
  },
  {
    id: 'solution-generation',
    weight: 0.1,
    optionCriteria: { A: 4, B: 3, C: 0, D: 0 },
    includeInE2ECheck: true,
  },
  {
    id: 'evaluation-decision',
    weight: 0.1,
    optionCriteria: { A: 4, B: 3, C: 0 },
    includeInE2ECheck: true,
  },
  {
    id: 'solution-implementation',
    weight: 0.05,
    optionCriteria: { A: 2, B: 1, C: 0 },
    includeInE2ECheck: true,
  },
];

const RAN_FM_SUB_SCENARIOS: ScoringSubScenarioInput[] = [
  { id: 'equipment', code: 'EQUIPMENT', faultDistributionWeight: 0.15 },
  { id: 'processing-error', code: 'PROCESSING_ERROR', faultDistributionWeight: 0.15 },
  { id: 'communications', code: 'COMMUNICATIONS', faultDistributionWeight: 0.3 },
  { id: 'environmental', code: 'ENVIRONMENTAL', faultDistributionWeight: 0.3 },
  { id: 'security', code: 'SECURITY', faultDistributionWeight: 0.1 },
];

function allA(subScenarioId: string): ScoringAnswerInput[] {
  return RAN_FM_QUESTIONS.map((q) => ({
    questionId: q.id,
    subScenarioId,
    selectedOption: 'A' as const,
  }));
}

describe('computeScoreResult — golden master (RAN_FM.xlsx demo answers)', () => {
  // Verified against the xlsx's own cached formula values: sub-scenario scores
  // 4 / 3.83 / 3.8 / 4 / 4, final score 3.9145, E2E rate 0.7 (Communications fails E2E
  // because its "Data collection & Alarm filtering" answer is B, not A).
  const answers: ScoringAnswerInput[] = [
    ...allA('equipment'),
    ...allA('processing-error').map((a) =>
      a.questionId === 'intent' ? { ...a, selectedOption: 'B' as const } : a,
    ),
    ...allA('communications').map((a) =>
      a.questionId === 'data-collection' ? { ...a, selectedOption: 'B' as const } : a,
    ),
    ...allA('environmental'),
    ...allA('security'),
  ];

  const result = computeScoreResult({
    questions: RAN_FM_QUESTIONS,
    subScenarios: RAN_FM_SUB_SCENARIOS,
    answers,
  });

  it('computes the exact sub-scenario overall scores', () => {
    const byCode = Object.fromEntries(result.subScenarioScores.map((s) => [s.subScenarioCode, s]));
    expect(byCode.EQUIPMENT?.overallScore).toBe(4);
    expect(byCode.PROCESSING_ERROR?.overallScore).toBe(3.83);
    expect(byCode.COMMUNICATIONS?.overallScore).toBe(3.8);
    expect(byCode.ENVIRONMENTAL?.overallScore).toBe(4);
    expect(byCode.SECURITY?.overallScore).toBe(4);
  });

  it('computes the exact final score', () => {
    expect(result.finalScore).toBe(3.9145);
  });

  it('computes E2E achievement per sub-scenario, excluding Intent', () => {
    const byCode = Object.fromEntries(result.subScenarioScores.map((s) => [s.subScenarioCode, s]));
    expect(byCode.EQUIPMENT?.e2eAchieved).toBe(true);
    expect(byCode.PROCESSING_ERROR?.e2eAchieved).toBe(true); // Intent=B excluded, doesn't break E2E
    expect(byCode.COMMUNICATIONS?.e2eAchieved).toBe(false); // Data collection=B, not excluded
    expect(byCode.ENVIRONMENTAL?.e2eAchieved).toBe(true);
    expect(byCode.SECURITY?.e2eAchieved).toBe(true);
  });

  it('computes the exact E2E automation rate', () => {
    expect(result.e2eAutomationRate).toBe(0.7);
  });
});

describe('computeScoreResult — compensation rule (per ANLET compensation PDF)', () => {
  // Two "anchor" questions (top score = ceiling = 4) and one "capped" question (top
  // score = 3), matching the shape of Data collection & Alarm filtering / Fault
  // identification / Solution implementation in the real questionnaire.
  const questions: ScoringQuestionInput[] = [
    { id: 'anchor-1', weight: 1 / 3, optionCriteria: { A: 4, B: 0 }, includeInE2ECheck: true },
    { id: 'anchor-2', weight: 1 / 3, optionCriteria: { A: 4, B: 0 }, includeInE2ECheck: true },
    { id: 'capped', weight: 1 / 3, optionCriteria: { A: 3, B: 0 }, includeInE2ECheck: true },
  ];
  const subScenarios: ScoringSubScenarioInput[] = [
    { id: 's1', code: 'EQUIPMENT', faultDistributionWeight: 1 },
  ];

  it('compensates the capped question up to the anchor average when it reaches its own top and the average exceeds it', () => {
    const result = computeScoreResult({
      questions,
      subScenarios,
      answers: [
        { questionId: 'anchor-1', subScenarioId: 's1', selectedOption: 'A' },
        { questionId: 'anchor-2', subScenarioId: 's1', selectedOption: 'A' },
        { questionId: 'capped', subScenarioId: 's1', selectedOption: 'A' }, // reaches its own top (3)
      ],
    });
    // anchor average = 4; capped's original (3) is bumped to 4 -> overall = (4+4+4)/3
    expect(result.subScenarioScores[0]?.overallScore).toBe(4);
  });

  it('does not compensate when the capped question has not reached its own top score', () => {
    const result = computeScoreResult({
      questions,
      subScenarios,
      answers: [
        { questionId: 'anchor-1', subScenarioId: 's1', selectedOption: 'A' },
        { questionId: 'anchor-2', subScenarioId: 's1', selectedOption: 'A' },
        { questionId: 'capped', subScenarioId: 's1', selectedOption: 'B' }, // original 0, own top is 3
      ],
    });
    // anchor average = 4, but capped hasn't reached its own top -> stays at 0
    expect(result.subScenarioScores[0]?.overallScore).toBe(2.6667);
  });

  it('does not compensate when the anchor average does not strictly exceed the capped top score', () => {
    const result = computeScoreResult({
      questions,
      subScenarios,
      answers: [
        { questionId: 'anchor-1', subScenarioId: 's1', selectedOption: 'A' }, // 4
        { questionId: 'anchor-2', subScenarioId: 's1', selectedOption: 'B' }, // 0
        { questionId: 'capped', subScenarioId: 's1', selectedOption: 'A' }, // reaches own top (3)
      ],
    });
    // anchor average = (4+0)/2 = 2, which is not > capped's own top (3) -> stays at 3
    expect(result.subScenarioScores[0]?.overallScore).toBe(2.3333);
  });
});

describe('computeScoreResult — edge cases', () => {
  it('handles the minimum (lowest available option) score for every question', () => {
    const questions: ScoringQuestionInput[] = [
      { id: 'q1', weight: 0.5, optionCriteria: { A: 4, B: 3, C: 0 }, includeInE2ECheck: true },
      { id: 'q2', weight: 0.5, optionCriteria: { A: 3, B: 2, C: 1, D: 0 }, includeInE2ECheck: true },
    ];
    const subScenarios: ScoringSubScenarioInput[] = [
      { id: 's1', code: 'EQUIPMENT', faultDistributionWeight: 1 },
    ];
    const result = computeScoreResult({
      questions,
      subScenarios,
      answers: [
        { questionId: 'q1', subScenarioId: 's1', selectedOption: 'C' },
        { questionId: 'q2', subScenarioId: 's1', selectedOption: 'D' },
      ],
    });
    expect(result.subScenarioScores[0]?.overallScore).toBe(0);
    expect(result.finalScore).toBe(0);
    expect(result.subScenarioScores[0]?.e2eAchieved).toBe(false);
  });

  it('handles a question with only 3 options (no D)', () => {
    const questions: ScoringQuestionInput[] = [
      { id: 'q1', weight: 1, optionCriteria: { A: 4, B: 2, C: 0 }, includeInE2ECheck: true },
    ];
    const subScenarios: ScoringSubScenarioInput[] = [
      { id: 's1', code: 'EQUIPMENT', faultDistributionWeight: 1 },
    ];
    const result = computeScoreResult({
      questions,
      subScenarios,
      answers: [{ questionId: 'q1', subScenarioId: 's1', selectedOption: 'C' }],
    });
    expect(result.subScenarioScores[0]?.overallScore).toBe(0);
  });
});
