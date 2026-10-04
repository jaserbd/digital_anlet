import { describe, expect, it } from 'vitest';
import { parseIpFmXlsx } from './parseIpFmXlsx';
import { scoreAnswers, scoreDemoAnswers } from './demoAnswers.testUtils';

describe('parseIpFmXlsx', () => {
  const parsed = parseIpFmXlsx();

  it('places the questionnaire under the IP domain', () => {
    expect(parsed).toMatchObject({
      code: 'IP_FM_GB1523E',
      networkType: 'IP',
      hvsCategory: 'Fault Management',
      hasE2ECheck: true,
    });
  });

  it('parses 8 sub-scenarios with their categories and fault-distribution weights', () => {
    expect(parsed.subScenarios.map((s) => [s.name, s.category, s.faultDistributionWeight])).toEqual(
      [
        ['Hardware Failure', 'Equipment', 0.05],
        ['Device Offline', 'Communication', 0.1],
        ['Optical Module Failure or Optical Power Abnormal', 'Communication', 0.15],
        ['Port Failure', 'Communication', 0.4],
        ['High Error Rate', 'Communication', 0.05],
        ['Protocol State Abnormal', 'Communication', 0.1],
        ['VPN Degradation', 'Quality of service', 0.1],
        ['VPN Interruption', 'Quality of service', 0.05],
      ],
    );
  });

  it('takes sub-scenario descriptions from the Introduction sheet', () => {
    expect(parsed.subScenarios[1]!.description).toMatch(/^Device Offline: device is unaccessable/);
  });

  it('parses 8 questions whose weights sum to 1, with Intent excluded from E2E', () => {
    expect(parsed.questions).toHaveLength(8);
    const total = parsed.questions.reduce((sum, q) => sum + q.weight, 0);
    expect(Math.round(total * 10000) / 10000).toBe(1);
    expect(
      parsed.questions.filter((q) => !q.includeInE2ECheck).map((q) => q.cognitiveActivity),
    ).toEqual(['Intent']);
  });

  it("takes criteria from the Scoring sheet where the questionnaire sheet's inline criteria are missing", () => {
    const byCapability = Object.fromEntries(parsed.questions.map((q) => [q.serviceCapability, q]));
    // No inline criteria at all on the questionnaire sheet for this row.
    expect(byCapability['Solution Generation']?.optionCriteria).toEqual({ A: 4, B: 3, C: 2, D: 1 });
    // Inline criteria stop at C; the Scoring sheet scores D=0.
    expect(byCapability['Data Collection& Alarm filtering']?.optionCriteria).toEqual({
      A: 3,
      B: 2,
      C: 1,
      D: 0,
    });
    expect(byCapability['Solution Implementation']?.optionCriteria).toEqual({ A: 3, B: 2, C: 1 });
  });

  it('keeps question notes inline and has no per-question guidance', () => {
    expect(parsed.questions[0]!.questionText).toContain('Note:');
    expect(parsed.questions.every((q) => q.answeringGuideline === null)).toBe(true);
    expect(parsed.guidelineText).toContain('IP network domain');
  });

  it("reproduces the workbook's cached demo results (capability score 0.9, E2E rate 0)", () => {
    const result = scoreDemoAnswers(parsed, {
      fileName: 'IP_FM.xlsx',
      questionSheet: 'IP Network - Fault Management',
      firstQuestionRow: 4,
      firstSubScenarioColumn: 15,
    });
    expect(result.finalScore).toBeCloseTo(0.9, 4);
    expect(result.e2eAutomationRate).toBe(0);
  });

  it('compensates Awareness and Execution (top score 3) when every other answer is A', () => {
    const answers = parsed.questions.flatMap((q) =>
      parsed.subScenarios.map((s) => ({
        questionId: `q${q.sortOrder}`,
        subScenarioId: s.code,
        selectedOption: 'A' as const,
      })),
    );
    const result = scoreAnswers(parsed, answers);
    expect(result.finalScore).toBeCloseTo(4, 4);
    expect(result.e2eAutomationRate).toBeCloseTo(1, 4);
  });
});
