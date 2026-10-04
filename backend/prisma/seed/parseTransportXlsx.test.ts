import { describe, expect, it } from 'vitest';
import { parseTransportMicrowaveXlsx, parseTransportOtnXlsx } from './parseTransportXlsx';
import { scoreAnswers, scoreDemoAnswers } from './demoAnswers.testUtils';

describe('parseTransportMicrowaveXlsx', () => {
  const parsed = parseTransportMicrowaveXlsx();

  it('is a Transport HVS with no E2E checklist', () => {
    expect(parsed).toMatchObject({
      code: 'TRANSPORT_MW_FM_GB1523D',
      networkType: 'Transport',
      hvsCategory: 'Fault Management',
      hasE2ECheck: false,
    });
  });

  it('parses 4 sub-scenarios grouped under 3 categories', () => {
    expect(parsed.subScenarios.map((s) => [s.code, s.category, s.faultDistributionWeight])).toEqual(
      [
        ['INDOOR_TO_OUTDOOR_UNIT_COMMUNICATION_FAILURE', 'Communication', 0.3],
        ['LINK_PERFORMANCE_DEGRADATION', 'Communication', 0.2],
        ['EQUIPMENT_MODULE_FAILURE', 'Equipment', 0.3],
        ['INTERFERENCE_ENVIRONMENTAL_IMPACT', 'Environmental', 0.2],
      ],
    );
  });

  it('parses 9 questions (two Intent questions) whose weights sum to 1, each with guidance', () => {
    expect(parsed.questions).toHaveLength(9);
    expect(parsed.questions.filter((q) => q.cognitiveActivity === 'Intent')).toHaveLength(2);
    const total = parsed.questions.reduce((sum, q) => sum + q.weight, 0);
    expect(Math.round(total * 10000) / 10000).toBe(1);
    expect(parsed.questions.every((q) => q.answeringGuideline)).toBe(true);
  });

  it("reproduces the workbook's cached demo scores for the sub-scenarios the app can represent", () => {
    const result = scoreDemoAnswers(parsed, {
      fileName: 'Transport.xlsx',
      questionSheet: 'Questionnaire Microwave',
      firstQuestionRow: 4,
      firstSubScenarioColumn: 11,
    });
    // Cached Overall Scores: 4, 2.7, 1.7, 0.8 (capability 2.41). The 4th demo column answers
    // D on Data Collection and Solution Implementation, which only offer A-C (the workbook
    // silently scores them 0) — not a reachable state in the app, so only columns 1-3 compare.
    expect(result.subScenarioScores.slice(0, 3).map((s) => s.overallScore)).toEqual([4, 2.7, 1.7]);
  });

  it('applies the general compensation rule, not Scoring_Microwave\'s copied "Intent Fulfilment = 3" formula', () => {
    // Intent Fulfilment's top score is 4 (the ceiling), so a B (3) is never compensated —
    // the workbook's own formula would bump it to 4 here.
    const answers = parsed.questions.flatMap((q) =>
      parsed.subScenarios.map((s) => ({
        questionId: `q${q.sortOrder}`,
        subScenarioId: s.code,
        selectedOption:
          q.serviceCapability === 'Intent Fulfilment' ? ('B' as const) : ('A' as const),
      })),
    );
    const intentFulfilment = parsed.questions.find(
      (q) => q.serviceCapability === 'Intent Fulfilment',
    )!;
    const result = scoreAnswers(parsed, answers);
    const scores = result.questionScores.filter(
      (qs) => qs.questionId === `q${intentFulfilment.sortOrder}`,
    );
    expect(scores.every((qs) => qs.compensatedScore === 3)).toBe(true);
  });
});

describe('parseTransportOtnXlsx', () => {
  const parsed = parseTransportOtnXlsx();

  it('is a separate Transport HVS with no E2E checklist', () => {
    expect(parsed).toMatchObject({
      code: 'TRANSPORT_OTN_FM_GB1523D',
      networkType: 'Transport',
      hvsCategory: 'Fault Management',
      hasE2ECheck: false,
    });
  });

  it('parses 6 sub-scenarios grouped under 3 categories', () => {
    expect(parsed.subScenarios.map((s) => [s.name, s.category, s.faultDistributionWeight])).toEqual(
      [
        ['Board/Module Fault', 'Equipment', 0.1],
        ['Line Interruption', 'Communication', 0.45],
        ['Optical Power Fault', 'Communication', 0.2],
        ['Client Side Fault', 'Communication', 0.1],
        ['Line BER', 'Communication', 0.1],
        ['power & high temperature', 'Environmental', 0.05],
      ],
    );
  });

  it('parses 8 questions whose weights sum to 1', () => {
    expect(parsed.questions).toHaveLength(8);
    const total = parsed.questions.reduce((sum, q) => sum + q.weight, 0);
    expect(Math.round(total * 10000) / 10000).toBe(1);
  });

  it('maps the shared Guideline, skipping the Microwave-only Intent Fulfilment row', () => {
    expect(parsed.questions[0]!.answeringGuideline).toMatch(/^\(A\) Based on Intent entered/);
    expect(parsed.questions[1]!.answeringGuideline).toMatch(
      /^\(A\) The System automatically collects data/,
    );
    expect(parsed.questions[7]!.answeringGuideline).toMatch(/automatically executes the commands/);
  });

  it("reproduces the workbook's cached demo score for its only answered sub-scenario (0.9)", () => {
    // The demo only fills in Board/Module Fault; the rest are blank (skips here).
    const result = scoreDemoAnswers(parsed, {
      fileName: 'Transport.xlsx',
      questionSheet: 'OTN Questionnaire',
      firstQuestionRow: 4,
      firstSubScenarioColumn: 11,
    });
    expect(result.subScenarioScores[0]!.overallScore).toBeCloseTo(0.9, 4);
    expect(result.subScenarioScores.slice(1).every((s) => s.overallScore === null)).toBe(true);
    expect(result.finalScore).toBeCloseTo(0.9, 4);
  });
});
