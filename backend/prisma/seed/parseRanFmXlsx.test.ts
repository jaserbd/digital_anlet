import { describe, expect, it } from 'vitest';
import { parseRanFmXlsx } from './parseRanFmXlsx';

describe('parseRanFmXlsx', () => {
  const parsed = parseRanFmXlsx();

  it('parses the 5 sub-scenarios with the correct codes and fault-distribution weights', () => {
    expect(parsed.subScenarios.map((s) => [s.code, s.faultDistributionWeight])).toEqual([
      ['EQUIPMENT', 0.15],
      ['PROCESSING_ERROR', 0.15],
      ['COMMUNICATIONS', 0.3],
      ['ENVIRONMENTAL', 0.3],
      ['SECURITY', 0.1],
    ]);
  });

  it('parses exactly 8 questions whose weights sum to 1', () => {
    expect(parsed.questions).toHaveLength(8);
    const total = parsed.questions.reduce((sum, q) => sum + q.weight, 0);
    expect(Math.round(total * 10000) / 10000).toBe(1);
  });

  it('parses cognitive activity and criteria matching the verified Scoring sheet values', () => {
    const byCapability = Object.fromEntries(parsed.questions.map((q) => [q.serviceCapability, q]));

    expect(byCapability['Intent-driven']?.cognitiveActivity).toBe('Intent');
    expect(byCapability['Intent-driven']?.optionCriteria).toEqual({ A: 4, B: 3, C: 0 });
    expect(byCapability['Intent-driven']?.includeInE2ECheck).toBe(false);

    expect(byCapability['Data collection & Alarm filtering']?.cognitiveActivity).toBe('Awareness');
    expect(byCapability['Data collection & Alarm filtering']?.optionCriteria).toEqual({
      A: 3,
      B: 2,
      C: 1,
      D: 0,
    });
    expect(byCapability['Data collection & Alarm filtering']?.includeInE2ECheck).toBe(true);

    expect(byCapability['Solution implementation']?.cognitiveActivity).toBe('Execution');
    expect(byCapability['Solution implementation']?.optionCriteria).toEqual({ A: 2, B: 1, C: 0 });
  });

  it('carries cognitive activity forward across merged-cell rows within the same IAADE group', () => {
    // "Fault Prediction" is the 2nd Awareness-activity row in the sheet, with a blank
    // cognitive-activity cell (merged with "Data collection & Alarm filtering" above it).
    const byCapability = Object.fromEntries(parsed.questions.map((q) => [q.serviceCapability, q]));
    expect(byCapability['Fault Prediction']?.cognitiveActivity).toBe('Awareness');
  });
});
