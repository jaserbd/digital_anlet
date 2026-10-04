import { describe, expect, it } from 'vitest';
import { parseFixedAccessXlsx } from './parseFixedAccessXlsx';
import { scoreDemoAnswers } from './demoAnswers.testUtils';

describe('parseFixedAccessXlsx', () => {
  const parsed = parseFixedAccessXlsx();

  it('places the questionnaire under the Fixed Access domain', () => {
    expect(parsed).toMatchObject({
      code: 'FIXED_ACCESS_FM_GB1523C',
      networkType: 'Fixed Access',
      hasE2ECheck: true,
    });
  });

  it('parses 4 uncategorized sub-scenarios with their weights and Guideline descriptions', () => {
    expect(parsed.subScenarios.map((s) => [s.name, s.category, s.faultDistributionWeight])).toEqual(
      [
        ['Device & Hardware Failure', null, 0.4],
        ['Optical Access Degradation', null, 0.3],
        ['Connectivity Failure', null, 0.15],
        ['Service State Abnormal', null, 0.15],
      ],
    );
    expect(parsed.subScenarios[0]!.description).toMatch(
      /^Device & Hardware Failure: device or hardware/,
    );
  });

  it('parses 9 questions whose weights sum to 1', () => {
    expect(parsed.questions).toHaveLength(9);
    const total = parsed.questions.reduce((sum, q) => sum + q.weight, 0);
    expect(Math.round(total * 10000) / 10000).toBe(1);
  });

  it('drops Scoring-sheet criteria for options the question does not offer', () => {
    const execution = parsed.questions.find((q) => q.cognitiveActivity === 'Execution')!;
    // Scoring sheet has A=2, B=1, C=0, D=0 but the question only offers A-C.
    expect(execution.optionCriteria).toEqual({ A: 2, B: 1, C: 0 });
    expect(execution.optionText.D).toBeUndefined();
  });

  it("matches answering guidance by the guideline row's question text, not its shifted label", () => {
    const byCapability = Object.fromEntries(parsed.questions.map((q) => [q.serviceCapability, q]));
    // The guideline row labelled "Fault Prediction" actually describes fault identification.
    expect(
      byCapability['Fault Identification ,Risk identification, impact analysis']
        ?.answeringGuideline,
    ).toMatch(/^\(A\) The System continuously detects risks/);
    expect(byCapability['Fault Demarcation']?.answeringGuideline).toMatch(
      /demarcates the fault domain/,
    );
    // No guideline row exists for Fault Prediction.
    expect(byCapability['Fault Prediction']?.answeringGuideline).toBeNull();
    expect(parsed.questions.filter((q) => q.answeringGuideline != null)).toHaveLength(8);
  });

  it("reproduces the workbook's cached demo results (all A: score 4, E2E rate 1)", () => {
    const result = scoreDemoAnswers(parsed, {
      fileName: 'Fixed_Access.xlsx',
      questionSheet: 'Questionnaire',
      firstQuestionRow: 4,
      firstSubScenarioColumn: 9,
    });
    expect(result.finalScore).toBeCloseTo(4, 4);
    expect(result.e2eAutomationRate).toBeCloseTo(1, 4);
  });

  it('has no KEI block', () => {
    expect(parsed.effectivenessIndicators).toEqual([]);
    expect(parsed.keiNote).toBeNull();
  });
});
