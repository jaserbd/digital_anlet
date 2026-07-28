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

  it('exposes a per-question compensated score consistent with the sub-scenario overall score', () => {
    // Equipment is all-A: the 3 capped questions (data-collection, fault-identification,
    // solution-implementation) each hit their own top score and compensate up to the
    // anchor average (4, since every anchor also scored A=4) — matching the known
    // Equipment overallScore of 4.
    const equipment = result.questionScores.filter((qs) => qs.subScenarioId === 'equipment');
    const byQuestion = Object.fromEntries(equipment.map((qs) => [qs.questionId, qs]));
    expect(byQuestion['data-collection']).toEqual({
      questionId: 'data-collection',
      subScenarioId: 'equipment',
      originalScore: 3,
      compensatedScore: 4,
    });
    expect(byQuestion['solution-implementation']).toEqual({
      questionId: 'solution-implementation',
      subScenarioId: 'equipment',
      originalScore: 2,
      compensatedScore: 4,
    });
    // Intent is itself an anchor (own top score 4 == ceiling) — never compensated.
    expect(byQuestion['intent']).toEqual({
      questionId: 'intent',
      subScenarioId: 'equipment',
      originalScore: 4,
      compensatedScore: 4,
    });
    // Every question has an entry for every sub-scenario (8 questions x 5 sub-scenarios).
    expect(result.questionScores).toHaveLength(RAN_FM_QUESTIONS.length * RAN_FM_SUB_SCENARIOS.length);
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

// The 9 Core Network Fault Management questions, verified field-for-field against
// CORE_FM.xlsx's `Scoring-Fault Management` sheet (the questionnaire sheet's own inline
// criteria are stale/wrong for "Service verification" — see parseCoreFmXlsx.ts). The
// xlsx's own demo answers are trivially all-A, so these cases are hand-computed here to
// actually exercise compensation against this dataset's real weights/criteria/anchor set
// (5 anchors — same count as RAN FM, but a different, larger compensated set: 4 questions
// vs RAN's 3).
const CORE_FM_QUESTIONS: ScoringQuestionInput[] = [
  { id: 'data-collection', weight: 0.1, optionCriteria: { A: 3, B: 2, C: 1 }, includeInE2ECheck: true },
  { id: 'fault-identification', weight: 0.1, optionCriteria: { A: 3, B: 2, C: 1 }, includeInE2ECheck: true },
  { id: 'risk-prediction', weight: 0.1, optionCriteria: { A: 4, B: 3, C: 2, D: 1 }, includeInE2ECheck: true },
  { id: 'demarcation', weight: 0.15, optionCriteria: { A: 4, B: 3, C: 2, D: 1 }, includeInE2ECheck: true },
  { id: 'locating', weight: 0.15, optionCriteria: { A: 4, B: 3, C: 2, D: 1 }, includeInE2ECheck: true },
  { id: 'solution-generation', weight: 0.1, optionCriteria: { A: 4, B: 3, C: 2, D: 1 }, includeInE2ECheck: true },
  { id: 'solution-pre-verification', weight: 0.1, optionCriteria: { A: 4, B: 3, C: 2, D: 1 }, includeInE2ECheck: true },
  { id: 'solution-implementation', weight: 0.1, optionCriteria: { A: 2, B: 1 }, includeInE2ECheck: true },
  { id: 'service-verification', weight: 0.1, optionCriteria: { A: 3, B: 2, C: 1 }, includeInE2ECheck: true },
];

const CORE_FM_SUB_SCENARIOS: ScoringSubScenarioInput[] = [
  { id: 'equipment', code: 'EQUIPMENT', faultDistributionWeight: 0.1 },
  { id: 'communication-qos', code: 'COMMUNICATION_QOS', faultDistributionWeight: 0.8 },
];

describe('computeScoreResult — Core Network Fault Management (verified data, hand-computed)', () => {
  // Equipment: all-A. Communication & QoS: "Data collection" answered B (its own top is 3,
  // but B=2 doesn't reach it, so no compensation there), everything else A.
  const answers: ScoringAnswerInput[] = CORE_FM_QUESTIONS.flatMap((q) => [
    { questionId: q.id, subScenarioId: 'equipment', selectedOption: 'A' as const },
    {
      questionId: q.id,
      subScenarioId: 'communication-qos',
      selectedOption: q.id === 'data-collection' ? ('B' as const) : ('A' as const),
    },
  ]);

  const result = computeScoreResult({
    questions: CORE_FM_QUESTIONS,
    subScenarios: CORE_FM_SUB_SCENARIOS,
    answers,
  });

  it('compensates every capped question up to the anchor average on the all-A sub-scenario', () => {
    const equipment = result.subScenarioScores.find((s) => s.subScenarioCode === 'EQUIPMENT');
    expect(equipment?.overallScore).toBe(4);
  });

  it('does not compensate "Data collection" when it hasn\'t reached its own top score', () => {
    const commQos = result.subScenarioScores.find((s) => s.subScenarioCode === 'COMMUNICATION_QOS');
    // Data collection stays at 2 (B, hasn't reached its own top of 3); everything else
    // compensates to 4: 2*0.1 + 4*0.9 = 3.8
    expect(commQos?.overallScore).toBe(3.8);
  });

  it('weights the final score by the (non-1-summing) sub-scenario weights, normalized by their sum', () => {
    // (4*0.1 + 3.8*0.8) / (0.1+0.8) = 3.44 / 0.9
    expect(result.finalScore).toBe(3.8222);
  });

  it('fails E2E for the sub-scenario where a non-excluded question scored below A', () => {
    const equipment = result.subScenarioScores.find((s) => s.subScenarioCode === 'EQUIPMENT');
    const commQos = result.subScenarioScores.find((s) => s.subScenarioCode === 'COMMUNICATION_QOS');
    expect(equipment?.e2eAchieved).toBe(true);
    expect(commQos?.e2eAchieved).toBe(false); // Data collection = B
    expect(result.e2eAutomationRate).toBe(0.1); // only Equipment's weight counts
  });
});

// The 7 Core Network Stability questions, verified against CORE_FM.xlsx's
// `Scoring-Stability` sheet — every question tops out at 4 (unlike RAN FM/Core FM, there
// is no capped question at all), so compensation can never trigger for any of them. Only
// one sub-scenario exists (a synthetic "OVERALL", weight 1) since Stability has no real
// sub-scenarios.
const CORE_STABILITY_QUESTIONS: ScoringQuestionInput[] = [
  { id: 'stable-deployment', weight: 0.1, optionCriteria: { A: 4, B: 3, C: 2, D: 1 }, includeInE2ECheck: true },
  { id: 'control-plane-dr', weight: 0.15, optionCriteria: { A: 4, B: 3, C: 2, D: 1 }, includeInE2ECheck: true },
  { id: 'user-plane-dr', weight: 0.15, optionCriteria: { A: 4, B: 3, C: 2, D: 1 }, includeInE2ECheck: true },
  { id: 'infra-dr', weight: 0.15, optionCriteria: { A: 4, B: 3, C: 2, D: 1 }, includeInE2ECheck: true },
  { id: 'anti-signaling', weight: 0.15, optionCriteria: { A: 4, B: 3, C: 2, D: 1 }, includeInE2ECheck: true },
  { id: 'risk-prediction', weight: 0.15, optionCriteria: { A: 4, B: 3, C: 2, D: 1 }, includeInE2ECheck: true },
  { id: 'service-degradation', weight: 0.15, optionCriteria: { A: 4, B: 3, C: 2, D: 1 }, includeInE2ECheck: true },
];

describe('computeScoreResult — Core Network Stability (verified data, no compensation possible)', () => {
  it('never compensates, since every question shares the same top score (ceiling)', () => {
    const result = computeScoreResult({
      questions: CORE_STABILITY_QUESTIONS,
      subScenarios: [{ id: 'overall', code: 'OVERALL', faultDistributionWeight: 1 }],
      answers: [
        // "Stable deployment architecture" answered C (score 2, its own top is 4 — never
        // reached, so compensation could never apply here regardless).
        { questionId: 'stable-deployment', subScenarioId: 'overall', selectedOption: 'C' },
        ...CORE_STABILITY_QUESTIONS.filter((q) => q.id !== 'stable-deployment').map((q) => ({
          questionId: q.id,
          subScenarioId: 'overall',
          selectedOption: 'A' as const,
        })),
      ],
    });
    // 2*0.1 + 4*(0.15*6) = 0.2 + 3.6 = 3.8, single sub-scenario weight 1 -> final = 3.8
    expect(result.subScenarioScores[0]?.overallScore).toBe(3.8);
    expect(result.finalScore).toBe(3.8);
  });
});

describe('computeScoreResult — skipped answers (re-normalization)', () => {
  // Same 3-question shape as the compensation-rule fixture above: two anchors (top=4),
  // one capped question (top=3), all equal weight (1/3).
  const questions: ScoringQuestionInput[] = [
    { id: 'anchor-1', weight: 1 / 3, optionCriteria: { A: 4, B: 0 }, includeInE2ECheck: true },
    { id: 'anchor-2', weight: 1 / 3, optionCriteria: { A: 4, B: 0 }, includeInE2ECheck: true },
    { id: 'capped', weight: 1 / 3, optionCriteria: { A: 3, B: 0 }, includeInE2ECheck: true },
  ];

  it('excludes a skipped question and re-normalizes the remaining weights, instead of scoring it 0', () => {
    const subScenarios: ScoringSubScenarioInput[] = [
      { id: 's1', code: 'EQUIPMENT', faultDistributionWeight: 1 },
    ];
    const result = computeScoreResult({
      questions,
      subScenarios,
      answers: [
        { questionId: 'anchor-1', subScenarioId: 's1', selectedOption: 'A' }, // 4
        { questionId: 'anchor-2', subScenarioId: 's1', selectedOption: 'B' }, // 0
        // 'capped' has no answer at all — skipped, not scored as 0.
      ],
    });
    // Re-normalized average of the two answered questions only: (4+0)/2 = 2. If the skip
    // had instead been scored as 0, the result would be (4+0+0)/3 = 1.3333 — different.
    expect(result.subScenarioScores[0]?.overallScore).toBe(2);
    expect(result.finalScore).toBe(2);

    const byQuestion = Object.fromEntries(result.questionScores.map((qs) => [qs.questionId, qs]));
    expect(byQuestion['anchor-1']).toEqual({
      questionId: 'anchor-1',
      subScenarioId: 's1',
      originalScore: 4,
      compensatedScore: 4,
    });
    expect(byQuestion['anchor-2']).toEqual({
      questionId: 'anchor-2',
      subScenarioId: 's1',
      originalScore: 0,
      compensatedScore: 0,
    });
    // The skipped question still gets an entry (for the results-page matrix), just with
    // both scores null instead of being omitted.
    expect(byQuestion['capped']).toEqual({
      questionId: 'capped',
      subScenarioId: 's1',
      originalScore: null,
      compensatedScore: null,
    });
  });

  it('sets overallScore to null when every question in a sub-scenario is skipped, and excludes it from the final score', () => {
    const subScenarios: ScoringSubScenarioInput[] = [
      { id: 's1-empty', code: 'EQUIPMENT', faultDistributionWeight: 0.6 },
      { id: 's2-full', code: 'PROCESSING_ERROR', faultDistributionWeight: 0.4 },
    ];
    const result = computeScoreResult({
      questions,
      subScenarios,
      answers: [
        // s1-empty: no answers at all.
        { questionId: 'anchor-1', subScenarioId: 's2-full', selectedOption: 'A' },
        { questionId: 'anchor-2', subScenarioId: 's2-full', selectedOption: 'A' },
        { questionId: 'capped', subScenarioId: 's2-full', selectedOption: 'A' }, // compensates to 4
      ],
    });
    const s1 = result.subScenarioScores.find((s) => s.subScenarioCode === 'EQUIPMENT');
    const s2 = result.subScenarioScores.find((s) => s.subScenarioCode === 'PROCESSING_ERROR');
    expect(s1?.overallScore).toBeNull();
    expect(s1?.e2eAchieved).toBe(false);
    expect(s2?.overallScore).toBe(4);
    // Final score is the weighted average of only the scored sub-scenario (s2), re-normalized
    // by its own weight (0.4), not diluted by the empty s1: (4*0.4)/0.4 = 4.
    expect(result.finalScore).toBe(4);
  });

  it('falls back to a final score of 0 without throwing when every sub-scenario is entirely skipped', () => {
    const subScenarios: ScoringSubScenarioInput[] = [
      { id: 's1', code: 'EQUIPMENT', faultDistributionWeight: 1 },
    ];
    const result = computeScoreResult({ questions, subScenarios, answers: [] });
    expect(result.subScenarioScores[0]?.overallScore).toBeNull();
    expect(result.finalScore).toBe(0);
    expect(result.e2eAutomationRate).toBe(0);
  });
});
