import { describe, expect, it } from 'vitest';
import { parseCoreFaultManagementXlsx, parseCoreStabilityXlsx } from './parseCoreFmXlsx';

describe('parseCoreFaultManagementXlsx', () => {
  const parsed = parseCoreFaultManagementXlsx();

  it('parses the 2 sub-scenarios with their fault-distribution weights', () => {
    expect(parsed.subScenarios.map((s) => [s.code, s.faultDistributionWeight])).toEqual([
      ['EQUIPMENT', 0.1],
      ['COMMUNICATION_QOS', 0.8],
    ]);
  });

  it('excludes the non-functional "Intent" placeholder row (weight 0, "n/a" text)', () => {
    expect(parsed.questions).toHaveLength(9);
    expect(parsed.questions.some((q) => q.cognitiveActivity === 'Intent')).toBe(false);
  });

  it('parses 9 questions whose weights sum to 1', () => {
    const total = parsed.questions.reduce((sum, q) => sum + q.weight, 0);
    expect(Math.round(total * 10000) / 10000).toBe(1);
  });

  it('parses criteria from the Scoring sheet, not the questionnaire sheet\'s stale inline values', () => {
    const byCapability = Object.fromEntries(
      parsed.questions.map((q) => [q.serviceCapability.trim(), q]),
    );

    // Verified against the real compensation formula in Scoring-Fault Management (which
    // sheet's numbers are actually load-bearing) — the questionnaire sheet's own inline
    // criteria for this row say A=4 with a D option, which is wrong/stale.
    expect(byCapability['Service verification']?.optionCriteria).toEqual({ A: 3, B: 2, C: 1 });
    expect(byCapability['Service verification']?.optionText.D).toBeUndefined();

    // Both 3-option (no D) and 2-option (Solution implementation) questions parse cleanly.
    expect(byCapability['Data collection\nAlarm correlation']?.optionCriteria).toEqual({
      A: 3,
      B: 2,
      C: 1,
    });
    expect(byCapability['Solution implementation']?.optionCriteria).toEqual({ A: 2, B: 1 });
  });

  it('carries cognitive activity forward across merged-cell rows', () => {
    const byCapability = Object.fromEntries(
      parsed.questions.map((q) => [q.serviceCapability.trim(), q]),
    );
    expect(byCapability['Risk prediction']?.cognitiveActivity).toBe('Analysis');
    expect(byCapability['Locating']?.cognitiveActivity).toBe('Analysis');
  });

  it('has hasE2ECheck true', () => {
    expect(parsed.hasE2ECheck).toBe(true);
  });

  it('extracts questionnaire-level guideline text from the Guideline sheet, with no per-question guidance', () => {
    expect(parsed.guidelineText).toContain(
      'The assessment is questionnaire-based and it is used to evaluate the Autonomous Networks (AN) level',
    );
    expect(parsed.questions.every((q) => q.answeringGuideline === null)).toBe(true);
  });
});

describe('parseCoreStabilityXlsx', () => {
  const parsed = parseCoreStabilityXlsx();

  it('has a single synthetic "OVERALL" sub-scenario with weight 1 (no real sub-scenarios)', () => {
    expect(parsed.subScenarios).toEqual([
      { code: 'OVERALL', name: 'Overall', description: '', faultDistributionWeight: 1, sortOrder: 0 },
    ]);
  });

  it('parses 7 questions whose weights sum to 1', () => {
    expect(parsed.questions).toHaveLength(7);
    const total = parsed.questions.reduce((sum, q) => sum + q.weight, 0);
    expect(Math.round(total * 10000) / 10000).toBe(1);
  });

  it('parses clean criteria from Scoring-Stability, ignoring the malformed inline values', () => {
    // The questionnaire sheet's own K-N columns have a literal "A" typed into a numeric
    // cell for the first 3 rows (a data-entry error) — Scoring-Stability is clean for all.
    for (const q of parsed.questions) {
      expect(q.optionCriteria).toEqual({ A: 4, B: 3, C: 2, D: 1 });
    }
  });

  it('has hasE2ECheck false (no sub-scenarios, no E2E checklist sheet exists for Stability)', () => {
    expect(parsed.hasE2ECheck).toBe(false);
  });

  it('shares the same guideline text as Core Fault Management (one Guideline sheet covers both)', () => {
    expect(parsed.guidelineText).toContain(
      'The assessment is questionnaire-based and it is used to evaluate the Autonomous Networks (AN) level',
    );
    expect(parsed.questions.every((q) => q.answeringGuideline === null)).toBe(true);
  });
});
