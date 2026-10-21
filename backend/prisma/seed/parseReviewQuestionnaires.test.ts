import { describe, expect, it } from 'vitest';
import type { AnswerOption } from '@anlet/shared';
import {
  NETWORK_LAYER_REVIEW_QUESTIONNAIRES,
  REVIEW_QUESTIONNAIRES,
  REVIEW_QUESTIONNAIRE_DIR,
  SERVICE_LAYER_REVIEW_QUESTIONNAIRES,
  parseReviewQuestionnaire,
  type ReviewQuestionnaireConfig,
} from './parseReviewQuestionnaires';
import { scoreAnswers, scoreDemoAnswers } from './demoAnswers.testUtils';
import type { ParsedQuestionnaire } from './parsedQuestionnaire.types';

const byCode = Object.fromEntries(REVIEW_QUESTIONNAIRES.map((c) => [c.code, c]));
const parsed = Object.fromEntries(
  REVIEW_QUESTIONNAIRES.map((c) => [c.code, parseReviewQuestionnaire(c)]),
) as Record<string, ParsedQuestionnaire>;

function demoScore(code: string, sheet?: { questionSheet: string; firstQuestionRow: number; firstSubScenarioColumn: number }) {
  const config = byCode[code] as ReviewQuestionnaireConfig;
  return scoreDemoAnswers(parsed[code]!, {
    fileName: `${REVIEW_QUESTIONNAIRE_DIR}/${config.fileName}`,
    questionSheet: config.layout.questionSheet,
    ...config.demo,
    ...sheet,
  });
}

/** Every sub-scenario answered `answers[sortOrder]` (default A). */
function uniformAnswers(p: ParsedQuestionnaire, answers: Record<number, AnswerOption> = {}) {
  return p.questions.flatMap((q) =>
    p.subScenarios.map((s) => ({
      questionId: `q${q.sortOrder}`,
      subScenarioId: s.code,
      selectedOption: answers[q.sortOrder] ?? ('A' as const),
    })),
  );
}

// [code, Domain, HVS, E2E checklist, questions, sub-scenario names and weights, KEIs]
const STRUCTURE: [string, string, string, boolean, number, [string, number][], number][] = [
  ['IP_PLANNING_GB1521E', 'IP', 'Planning', true, 7, [['Fundamental Planning', 0.4], ['Network Reliability', 0.3], ['Network Resilience', 0.3]], 0],
  ['RAN_DEPLOYMENT_GB1522A', 'RAN', 'Deployment', false, 8, [['4G RAN Network Elements', 0.3], ['5G NSA RAN Network Elements/Network Functions', 0.3], ['5G SA RAN Network Elements/Network Functions', 0.3], ['Other RAN Network Elements/Network Functions', 0.1]], 0],
  ['CORE_DEPLOYMENT_GB1522B', 'Core', 'Deployment', false, 8, [['Private Cloud 5GC with Full CNF Stack', 0.8], ['Other NF Core sub-scenario', 0.2]], 0],
  ['RAN_CHANGE_MGMT_GB1524A', 'RAN', 'Change Management', false, 9, [['Parameter Optimization & Tuning', 0.4], ['Feature Activation & Configuration Changes', 0.2], ['Capacity Expansions & Carrier Additions', 0.2], ['Cell Site Integration & Reconfiguration', 0.15], ['Software Upgrade & Patches', 0.05]], 2],
  ['CORE_CHANGE_MGMT_GB1524B', 'Core', 'Change Management', false, 9, [['Configuration Change', 0.4], ['Service Lifecycle Management Changes', 0.3], ['Software Upgrade', 0.2], ['Other sub-scenarios to be defined by CSP', 0.1]], 0],
  ['IP_CHANGE_MGMT_GB1524E', 'IP', 'Change Management', true, 9, [['Device Onboarding/decommissioning', 0.1], ['Software Upgrade', 0.3], ['Link Expansion', 0.1], ['BGP Route Policy Adjustment', 0.3], ['IGP Configuration Change', 0.1], ['VPN Service Provisioning', 0.1]], 0],
  ['RAN_QUALITY_OPT_GB1525A', 'RAN', 'Quality Optimization', false, 7, [['Capacity', 0.15], ['Interference', 0.15], ['Coverage Structure', 0.15], ['RAN Voice KPIs', 0.15], ['RAN Awareness-related KPIs', 0.15], ['Basic RAN KPIs', 0.25]], 2],
  ['TRANSPORT_OTN_QUALITY_OPT_GB1525D', 'Transport', 'Quality Optimization', false, 8, [['Availability Assurance', 0.6], ['Latency Assurance', 0.25], ['Bandwidth Assurance', 0.15]], 0],
  ['IP_QUALITY_OPT_GB1525E', 'IP', 'Quality Optimization', true, 7, [['Link Congestion Optimization', 0.3], ['Path Down Optimization', 0.4], ['VPN SLA Optimization', 0.2]], 1],
  ['RAN_ENERGY_EFF_GB1526A', 'RAN', 'Energy Efficiency Optimization', false, 9, [['Intra-RAT intra-frequency multi-Site energy saving', 0.2], ['Intra-RAT inter-frequency multi-Site energy saving', 0.4], ['Inter-RAT multi-Site energy saving', 0.4]], 1],
  ['RAN_ROUTINE_MAINT_GB1528A', 'RAN', 'Routine Maintenance', false, 8, [['Network Capacity & Utilization', 0.4], ['Configuration & Software Levels', 0.3], ['Access Control', 0.25], ['Other Sub-scenarios', 0.05]], 0],
  ['PROACTIVE_SECURITY_GB1529', 'Security', 'Proactive Security', false, 9, [['Threat Hunting', 0.35], ['Pen Testing', 0.3], ['Posture Management', 0.3], ['Other sub-scenarios', 0.05]], 0],
  // Service layer (batch B)
  ['SERVICE_DELIVERY_PRIVATE_LINE_GB1502D', 'Private Line', 'Service Delivery', false, 9, [['Overall', 1]], 4],
  ['SERVICE_ASSURANCE_INDIVIDUAL_GB1503A', 'Individual Services', 'Service Assurance', false, 8, [['Anomaly & Stability', 0.2], ['Performance', 0.4], ['Experience', 0.4]], 0],
  ['SERVICE_ASSURANCE_HBB_GB1503B', 'Home Broadband', 'Service Assurance', true, 7, [['Stuttering/lag', 0.35], ['Slowness', 0.35], ['Disconnection', 0.3]], 2],
  ['SERVICE_ASSURANCE_IP_PRIVATE_LINE_GB1503H', 'IP Private Line', 'Service Assurance', false, 8, [['Bandwidth', 0.2], ['Latency/Jitter', 0.2], ['Packet Loss', 0.2], ['Availability', 0.2], ['Security', 0.2]], 0],
  ['COMPLAINT_HANDLING_INDIVIDUAL_GB1504A', 'Individual Services', 'Complaint Handling', false, 9, [['Data Services Complaint', 0.55], ['Voice Services Complaint', 0.35], ['Other Network-Related Complaint', 0.1]], 0],
  ['COMPLAINT_HANDLING_HBB_GB1504B', 'Home Broadband', 'Complaint Handling', true, 8, [['No Connectivity', 0.4], ['Degraded Quality', 0.35], ['Intermittent / Instability', 0.25]], 0],
  ['SERVICE_FM_INDIVIDUAL_GB1505A', 'Individual Services', 'Service Fault Management', true, 8, [['Service outages', 0.7], ['Service degradation', 0.3]], 2],
];

describe('parseReviewQuestionnaires (REVIEW_QUESTIONNAIRES_PLAN.md)', () => {
  it('covers the 12 network-layer and 7 service-layer questionnaires', () => {
    expect(NETWORK_LAYER_REVIEW_QUESTIONNAIRES).toHaveLength(12);
    expect(SERVICE_LAYER_REVIEW_QUESTIONNAIRES).toHaveLength(7);
    expect(REVIEW_QUESTIONNAIRES.map((c) => c.code).sort()).toEqual(STRUCTURE.map((s) => s[0]).sort());
  });

  describe.each(STRUCTURE)('%s', (code, networkType, hvsCategory, hasE2ECheck, questionCount, subScenarios, keiCount) => {
    const p = parsed[code]!;

    it('is tagged in review and placed under its Domain / HVS', () => {
      expect(p).toMatchObject({ code, networkType, hvsCategory, hasE2ECheck, inReview: true });
    });

    it('has question weights summing to 1, Intent excluded from E2E', () => {
      expect(p.questions).toHaveLength(questionCount);
      expect(p.questions.reduce((sum, q) => sum + q.weight, 0)).toBeCloseTo(1, 6);
      expect(p.questions.filter((q) => !q.includeInE2ECheck).every((q) => q.cognitiveActivity === 'Intent')).toBe(true);
      expect(p.questions[0]!.cognitiveActivity).toBe('Intent');
    });

    it('parses its sub-scenarios and weights', () => {
      expect(p.subScenarios.map((s) => [s.name, s.faultDistributionWeight])).toEqual(subScenarios);
      expect(new Set(p.subScenarios.map((s) => s.code)).size).toBe(subScenarios.length);
    });

    it('scores every offered option, with A always the top score', () => {
      for (const q of p.questions) {
        expect(Object.keys(q.optionCriteria)).toEqual(Object.keys(q.optionText));
        expect(q.optionCriteria.A).toBe(Math.max(...Object.values(q.optionCriteria)));
      }
    });

    it(`parses ${keiCount} KEI(s)`, () => {
      expect(p.effectivenessIndicators).toHaveLength(keiCount);
      if (keiCount > 0) {
        expect(p.effectivenessIndicators.reduce((sum, k) => sum + k.weight, 0)).toBeCloseTo(1, 6);
      }
    });

    it('takes its context text from the source (GB1502D has no Guideline sheet)', () => {
      if (code === 'SERVICE_DELIVERY_PRIVATE_LINE_GB1502D') expect(p.guidelineText).toBeNull();
      else expect(p.guidelineText).toBeTruthy();
    });

    it('reaches the full score of 4 when every answer is A (compensation)', () => {
      const result = scoreAnswers(p, uniformAnswers(p));
      expect(result.finalScore).toBeCloseTo(4, 6);
      // The E2E rate sums the weights of the sub-scenarios reaching "Y" — 0.9 for GB1525E,
      // whose source weights add up to 0.9 (as Core FM's do).
      const weightSum = subScenarios.reduce((sum, [, weight]) => sum + weight, 0);
      expect(result.e2eAutomationRate).toBeCloseTo(weightSum, 6);
    });
  });

  it('gives every question answering guidance from its Guideline sheet, where the source has any', () => {
    // GB1525E has an Introduction sheet only, GB1502D no Guideline sheet, and GB1503B's
    // answering table lists the Cognitive Activities with every other cell empty.
    const without = ['IP_QUALITY_OPT_GB1525E', 'SERVICE_DELIVERY_PRIVATE_LINE_GB1502D', 'SERVICE_ASSURANCE_HBB_GB1503B'];
    for (const p of Object.values(parsed)) {
      const withGuidance = p.questions.filter((q) => q.answeringGuideline).length;
      expect([p.code, withGuidance]).toEqual([p.code, without.includes(p.code) ? 0 : p.questions.length]);
    }
  });

  it('maps guidance by content, not position (GB1525D copies a question text onto the wrong row)', () => {
    const otn = parsed.TRANSPORT_OTN_QUALITY_OPT_GB1525D!;
    const byCapability = Object.fromEntries(otn.questions.map((q) => [q.serviceCapability, q.answeringGuideline]));
    expect(byCapability['Problem Demarcation & Root Cause analysis']).toMatch(/isolates & analyzes/);
    expect(byCapability['Solution generation']).toMatch(/generates the solution/);
  });

  it('joins multi-row guidance blocks (GB1522B lists one row per option)', () => {
    const guidance = parsed.CORE_DEPLOYMENT_GB1522B!.questions[2]!.answeringGuideline!;
    expect(guidance).toMatch(/^\(A\)/);
    expect(guidance).toContain('(D) Manual correlation of multiple data sources');
  });

  it('drops placeholder "Other" sub-scenarios weighted 0 or "% TBD", keeps weighted ones', () => {
    expect(parsed.RAN_CHANGE_MGMT_GB1524A!.subScenarios.some((s) => /^Other/.test(s.name))).toBe(false);
    expect(parsed.IP_QUALITY_OPT_GB1525E!.subScenarios.some((s) => /^Other/.test(s.name))).toBe(false);
    expect(parsed.CORE_CHANGE_MGMT_GB1524B!.subScenarios.at(-1)!.faultDistributionWeight).toBe(0.1);
  });

  it('reads criteria from shifted columns (GB1521E Scoring E-H) and a Scoring-sheet weight row (GB1522A)', () => {
    expect(parsed.IP_PLANNING_GB1521E!.questions.map((q) => q.optionCriteria.A)).toEqual([4, 3, 4, 4, 4, 4, 2]);
    expect(parsed.IP_PLANNING_GB1521E!.subScenarios[0]!.description).toMatch(/^Fundamental planning: represents/);
  });

  it('groups IP Change Management sub-scenarios by category', () => {
    expect(parsed.IP_CHANGE_MGMT_GB1524E!.subScenarios.map((s) => s.category)).toEqual([
      'Device', 'Device', 'Device', 'Configuration', 'Configuration', 'Service',
    ]);
  });

  it('capitalizes a lower-case Cognitive Activity and keeps the non-IAADE "Perceived" (GB1525E)', () => {
    expect(parsed.IP_QUALITY_OPT_GB1525E!.questions.map((q) => q.cognitiveActivity)).toEqual([
      'Intent', 'Awareness', 'Perceived', 'Analysis', 'Analysis', 'Decision', 'Execution',
    ]);
  });

  // Golden masters: the workbooks' own demo answers vs the values their formulas cached.
  // Most demo sheets answer everything "A"; GB1521E, GB1524E and GB1525E have mixed answers.
  it.each([
    ['IP_PLANNING_GB1521E', 1.05, 0],
    ['RAN_DEPLOYMENT_GB1522A', 4, 1],
    ['CORE_DEPLOYMENT_GB1522B', 4, 1],
    ['RAN_CHANGE_MGMT_GB1524A', 4, 1],
    ['IP_CHANGE_MGMT_GB1524E', 0.8, 0],
    ['IP_QUALITY_OPT_GB1525E', 1, 0],
    ['RAN_ENERGY_EFF_GB1526A', 4, 1],
    ['RAN_ROUTINE_MAINT_GB1528A', 4, 1],
    ['PROACTIVE_SECURITY_GB1529', 4, 1],
    ['SERVICE_ASSURANCE_INDIVIDUAL_GB1503A', 4, 1],
    ['SERVICE_ASSURANCE_HBB_GB1503B', 3.91, 0.7],
    ['COMPLAINT_HANDLING_INDIVIDUAL_GB1504A', 4, 1],
    ['COMPLAINT_HANDLING_HBB_GB1504B', 4, 1],
  ])("reproduces %s's cached demo score %d (E2E rate %d)", (code, finalScore, e2eRate) => {
    const result = demoScore(code);
    expect(result.finalScore).toBeCloseTo(finalScore, 4);
    expect(result.e2eAutomationRate).toBeCloseTo(e2eRate, 4);
  });

  // Hand-computed with the general weighted rule. The source sheets differ here on purpose
  // (plan decision 1): GB1524B and GB1525A average unweighted, GB1525D scores one answer column.
  it('scores Core Change Management weighted: Intent B, rest A → 3.85 (the sheet\'s unweighted AVERAGE gives 3.8333)', () => {
    // Intent 3; ceiling-4 average = (3+4+4+4+4+4)/6 = 3.8333 compensates both Awareness
    // questions (top 3) and Implementation (top 2):
    // 0.1·3 + 0.2·3.8333 + 0.2·4 + 0.2·4 + 0.1·4 + 0.1·3.8333 + 0.1·4 = 3.85
    const p = parsed.CORE_CHANGE_MGMT_GB1524B!;
    expect(scoreAnswers(p, uniformAnswers(p, { 0: 'B' })).finalScore).toBeCloseTo(3.85, 4);
  });

  it('scores RAN Quality Optimization weighted: Intent B, rest A → 3.86', () => {
    // ceiling-4 average = (3+4+4+4+4)/5 = 3.8 compensates Awareness and Execution (top 3):
    // 0.1·3 + 0.1·3.8 + 0.15·4 + 0.2·4 + 0.2·4 + 0.15·4 + 0.1·3.8 = 3.86
    const p = parsed.RAN_QUALITY_OPT_GB1525A!;
    expect(scoreAnswers(p, uniformAnswers(p, { 0: 'B' })).finalScore).toBeCloseTo(3.86, 4);
  });

  it('scores OTN Quality Optimization per sub-scenario with its weights (0.6 / 0.25 / 0.15)', () => {
    // Availability all A (4); Latency all D (0 — D scores 0 on every question); Bandwidth unanswered.
    const p = parsed.TRANSPORT_OTN_QUALITY_OPT_GB1525D!;
    const answers = p.questions.flatMap((q) => [
      { questionId: `q${q.sortOrder}`, subScenarioId: 'AVAILABILITY_ASSURANCE', selectedOption: 'A' as const },
      ...(q.optionText.D ? [{ questionId: `q${q.sortOrder}`, subScenarioId: 'LATENCY_ASSURANCE', selectedOption: 'D' as const }] : []),
    ]);
    const result = scoreAnswers(p, answers);
    expect(result.subScenarioScores.map((s) => s.overallScore)).toEqual([4, 0, null]);
    // (0.6·4 + 0.25·0) / (0.6 + 0.25)
    expect(result.finalScore).toBeCloseTo(2.4 / 0.85, 4);
  });

  it("scores the IP Private Line demo's single scored column like the sheet (4), per sub-scenario", () => {
    // GB1503H's Scoring sheet scores one answer column only; the demo answers just that one.
    expect(demoScore('SERVICE_ASSURANCE_IP_PRIVATE_LINE_GB1503H').subScenarioScores.map((s) => s.overallScore)).toEqual([4, null, null, null, null]);
  });

  it('scores Private Line Service Delivery once per question, compensated: demo BABAAAAAA → 3.5 (the sheet, without compensation, gives 3.2)', () => {
    // Demo answers live in the Scoring sheet's J column (linked from another workbook).
    // Originals 3,3,3,3,3,4,3,4,3; ceiling-4 average (3+3+4+4)/4 = 3.5 compensates the five
    // top-3 questions: 0.1·3 + 0.1·3.5 + 0.1·3 + 0.15·3.5 + 0.15·3.5 + 0.1·4 + 0.1·3.5 + 0.1·4 + 0.1·3.5
    const result = demoScore('SERVICE_DELIVERY_PRIVATE_LINE_GB1502D', { questionSheet: 'Scoring', firstQuestionRow: 4, firstSubScenarioColumn: 9 });
    expect(result.finalScore).toBeCloseTo(3.5, 4);
    expect(parsed.SERVICE_DELIVERY_PRIVATE_LINE_GB1502D!.questions.map((q) => q.weight)).toEqual([0.1, 0.1, 0.1, 0.15, 0.15, 0.1, 0.1, 0.1, 0.1]);
  });

  it('strips "(A)" prefixes from option texts and "(35%)" / "(Sub-Scenario-1)" from sub-scenario headers', () => {
    expect(parsed.SERVICE_FM_INDIVIDUAL_GB1505A!.questions[0]!.optionText.A).toMatch(/^The operations/);
    expect(parsed.COMPLAINT_HANDLING_HBB_GB1504B!.subScenarios[0]!.description).toBe('No Connectivity');
    expect(parsed.SERVICE_ASSURANCE_HBB_GB1503B!.subScenarios[0]!.description).toMatch(/^Specific scenarios: gaming/);
  });

  it('scores the Home Broadband KEIs, which have no Scoring-sheet criteria, A-D = 4/3/2/1', () => {
    expect(parsed.SERVICE_ASSURANCE_HBB_GB1503B!.effectivenessIndicators.map((k) => [k.name, k.weight, k.optionCriteria])).toEqual([
      ['Mean Time to Recovery (MTTR)', 0.5, { A: 4, B: 3, C: 2, D: 1 }],
      ['End-to-End Automation Ratio', 0.5, { A: 4, B: 3, C: 2, D: 1 }],
    ]);
  });

  it('parses KEIs with criteria from the Scoring sheet', () => {
    expect(parsed.RAN_CHANGE_MGMT_GB1524A!.effectivenessIndicators.map((k) => [k.name, k.weight, k.optionCriteria])).toEqual([
      ['First Time Right (FTR)', 0.6, { A: 4, B: 3, C: 2, D: 1 }],
      ['Change Success Rate', 0.4, { A: 4, B: 3, C: 2, D: 1 }],
    ]);
    expect(parsed.RAN_QUALITY_OPT_GB1525A!.keiNote).toMatch(/^Note: the proposed values/);
    expect(parsed.RAN_ENERGY_EFF_GB1526A!.keiNote).toMatch(/One solution can be one energy saving action/);
  });
});
