// Parses the TM Forum questionnaires still "In Review" (REVIEW_QUESTIONNAIRES_PLAN.md) out of
// review_questionnaires/*.xlsx. One-time, dev/seed-time script only — see parseRanFmXlsx.ts's
// header comment for why xlsx/SheetJS's advisories are acceptable here.
//
// Every file shares the Fault Management layout fmSheetParser.ts already reads, so each entry
// below is configuration only: sheet names, row/column offsets, KEI block, guideline source.
// Seeded with inReview=true, i.e. named "… (R)" and opt-in per project.
//
// Known source defects, deliberately NOT replicated — scoring.ts's general rule (weighted
// average of compensated scores; compensate a question at its own top score to the average of
// the questions reaching the 4 ceiling) applies to every questionnaire:
// - GB1524B Core Change Management and GB1525A RAN Quality Optimization score each sub-scenario
//   as an unweighted AVERAGE of the question scores; GB1525A's compensation averages also start
//   with an empty argument (`AVERAGE(,P5,…)`, an extra 0) and GB1524B's U12 points at row 7.
// - Scoring sheets that score an option the question doesn't offer (e.g. D=0 on A-C questions)
//   are dropped by criteriaForOfferedOptions, as for the existing questionnaires.
// - GB1525D OTN Quality Optimization's Scoring sheet scores a single answer column although
//   the questionnaire defines 3 weighted sub-scenarios — answered per sub-scenario here.
// - "Other sub-scenarios (to be defined)" columns with weight 0 or "% TBD" (GB1524A, GB1525E)
//   are dropped; weighted ones (GB1524B, GB1528A, GB1529) stay.
// - GB1502D's Scoring sheet applies no compensation at all; GB1503B's has no KEI criteria (scored
//   A-D = 4/3/2/1 like every other in-review KEI).
// - GB1524A / GB1526A / GB1525A label a blended "High Value Scenario score" (GB1526A even
//   carries 0.75 / 0.25 weights) but compute none — the KEI score stays separate, as for IP.
import XLSX from 'xlsx';
import type { ParsedQuestionnaire } from './parsedQuestionnaire.types';
import {
  extractNumberedSubScenarioLines,
  readFmSheets,
  readKeis,
  type FmSheetLayout,
  type KeiLayout,
} from './fmSheetParser';
import { readStandardGuideline } from './standardGuideline';
import { joinColumnText, readSheetRows, repoRootXlsxPath } from './xlsxParseUtils';

export const REVIEW_QUESTIONNAIRE_DIR = 'review_questionnaires';

type Guideline =
  | { kind: 'standard' }
  // GB1502D has no Guideline sheet at all — no context text is invented.
  | { kind: 'none' }
  // An IP-style "Introduction" sheet: numbered points in one column, no per-question guidance.
  | { kind: 'introduction'; sheet: string; column: number; rows: [number, number] };

export interface ReviewQuestionnaireConfig {
  code: string;
  name: string;
  networkType: string;
  hvsCategory: string;
  hasE2ECheck: boolean;
  fileName: string;
  layout: Omit<FmSheetLayout, 'fileLabel'>;
  kei?: Omit<KeiLayout, 'fileLabel' | 'questionSheet' | 'scoringSheet'>;
  guideline: Guideline;
  /** No sub-scenarios: answered once per question, as a single synthetic "Overall" sub-scenario
   * (the Core Stability model). */
  singleAnswer?: boolean;
  /** Demo answers typed into the workbook, for the golden-master tests. */
  demo: { firstQuestionRow: number; firstSubScenarioColumn: number };
}

const COMMON = { categoryRow: null, complianceColumn: null, standardSourceColumn: null };

// Row and column numbers below are 0-based (row 4 = spreadsheet row 5, column 9 = J).
export const NETWORK_LAYER_REVIEW_QUESTIONNAIRES: ReviewQuestionnaireConfig[] = [
  {
    code: 'IP_PLANNING_GB1521E',
    name: 'IP Network Planning',
    networkType: 'IP',
    hvsCategory: 'Planning',
    hasE2ECheck: true,
    fileName: 'GB1521E_IP_Network_Planning_Questionnaire_v1.1.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Planning Questionnaire',
      scoringSheet: 'Scoring Planning',
      subScenarioNameRow: 1, // "Sub-scenario-1:\nFundamental Planning"
      subScenarioDescriptionRow: 2,
      subScenarioWeightRow: 3,
      subScenarioColumnStart: 13, // N
      subScenarioCount: 3,
      questionRows: [4, 10],
      scoringRowOffset: -1,
      scoringCriteriaColumn: 4, // Scoring Planning!E-H
      scoringTextCheckColumn: 2, // Service Capability
    },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 4, firstSubScenarioColumn: 13 },
  },
  {
    code: 'RAN_DEPLOYMENT_GB1522A',
    name: 'Wireless Network Deployment',
    networkType: 'RAN',
    hvsCategory: 'Deployment',
    hasE2ECheck: false,
    fileName: 'GB1522A_Wireless_Network_Deployment_Questionnaire_v2.0.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Questionnaire',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: null, // weights only on the Scoring sheet (row 3: N, Q, T, W)
      scoringSubScenarioWeights: { row: 2, columns: [13, 16, 19, 22] },
      subScenarioColumnStart: 10, // K
      subScenarioCount: 4,
      questionRows: [2, 9],
      scoringRowOffset: 2,
    },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 2, firstSubScenarioColumn: 10 },
  },
  {
    code: 'CORE_DEPLOYMENT_GB1522B',
    name: 'Core Network Deployment',
    networkType: 'Core',
    hvsCategory: 'Deployment',
    hasE2ECheck: false,
    fileName: 'GB1522B_Core_Network_Deployment_Questionnaire_v1.0.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Questionnaire',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 9, // J
      subScenarioCount: 2,
      questionRows: [3, 10],
      scoringRowOffset: 1,
      scoringTextCheckColumn: 2,
    },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 9 },
  },
  {
    code: 'RAN_CHANGE_MGMT_GB1524A',
    name: 'Wireless Network Change Management',
    networkType: 'RAN',
    hvsCategory: 'Change Management',
    hasE2ECheck: false,
    fileName: 'GB1524A_Wireless Network Change Management Questionnaire with indicators _V2.0.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Questionnaire',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 10, // K; P = "Other sub-scenarios to be defined" (% TBD), dropped
      subScenarioCount: 6,
      dropPlaceholderSubScenarios: true,
      questionRows: [3, 11],
      scoringRowOffset: 1,
      scoringTextCheckColumn: 2,
    },
    kei: { rows: [16, 17], scoringRowOffset: -1, scoringCriteriaColumn: 5, noteRow: null },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 10 },
  },
  {
    code: 'CORE_CHANGE_MGMT_GB1524B',
    name: 'Core Network Change Management',
    networkType: 'Core',
    hvsCategory: 'Change Management',
    hasE2ECheck: false,
    fileName: 'GB1524B_Core_Network_Change_Management_Questionnaire_v1.1.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Core Network Change Management',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 10, // K; N = "Other sub-scenarios to be defined" (0.1), kept
      subScenarioCount: 4,
      questionRows: [3, 11],
      scoringRowOffset: 1,
      // No scoringTextCheckColumn: this Scoring sheet keeps older question wording.
      
    },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 10 },
  },
  {
    code: 'IP_CHANGE_MGMT_GB1524E',
    name: 'IP Network Change Management',
    networkType: 'IP',
    hvsCategory: 'Change Management',
    hasE2ECheck: true,
    fileName: 'GB1524E_IP_Change_Management_Questionnaire_v1.1.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Change Management',
      scoringSheet: 'Scoring',
      categoryRow: 1, // Device | Configuration | Service
      subScenarioNameRow: 2,
      subScenarioWeightRow: 3,
      subScenarioColumnStart: 10, // K
      subScenarioCount: 6,
      questionRows: [4, 12],
      scoringRowOffset: 0,
      // No scoringTextCheckColumn: this Scoring sheet keeps older question wording.
      
    },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 4, firstSubScenarioColumn: 10 },
  },
  {
    code: 'RAN_QUALITY_OPT_GB1525A',
    name: 'RAN Network Quality Optimization',
    networkType: 'RAN',
    hvsCategory: 'Quality Optimization',
    hasE2ECheck: false,
    fileName: 'GB1525A_RAN Network Quality Optimization_Questionnaire_V1.1.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'RAN Network Optimization',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 9, // J
      subScenarioCount: 6,
      questionRows: [3, 9],
      scoringRowOffset: 1,
      complianceColumn: 15, // P
      standardSourceColumn: 16, // Q
    },
    kei: { rows: [15, 16], scoringRowOffset: -1, scoringCriteriaColumn: 5, noteRow: 18 },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 9 },
  },
  {
    code: 'TRANSPORT_OTN_QUALITY_OPT_GB1525D',
    name: 'Transport (OTN) Network Quality Optimization',
    networkType: 'Transport',
    hvsCategory: 'Quality Optimization',
    hasE2ECheck: false,
    fileName: 'GB1525D_Transport_(OTN)_Network_Quality_Optimization_Questionnaire_v1.0.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'OTN Quality Optimization',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 9, // J
      subScenarioCount: 3,
      questionRows: [3, 10],
      scoringRowOffset: 0,
    },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 9 },
  },
  {
    code: 'IP_QUALITY_OPT_GB1525E',
    name: 'IP Network Quality Optimization',
    networkType: 'IP',
    hvsCategory: 'Quality Optimization',
    hasE2ECheck: true,
    fileName: 'GB1525E_IP_Network_Quality_Optimization_Questionnaire_v2.0.1.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'IP Network-Quality Optimization',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 15, // P; S = "Other Subscenario" (weight 0), dropped
      subScenarioCount: 4,
      dropPlaceholderSubScenarios: true,
      questionRows: [3, 9],
      scoringRowOffset: 1,
      complianceColumn: 9, // J
      standardSourceColumn: 10, // K
    },
    kei: { rows: [14, 14], scoringRowOffset: 4, scoringCriteriaColumn: 4, noteRow: null },
    guideline: { kind: 'introduction', sheet: 'Introduction', column: 0, rows: [1, 5] },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 15 },
  },
  {
    code: 'RAN_ENERGY_EFF_GB1526A',
    name: 'RAN Energy Efficiency Optimization',
    networkType: 'RAN',
    hvsCategory: 'Energy Efficiency Optimization',
    hasE2ECheck: false,
    fileName: 'GB1526A_RAN_Energy_Efficiency_Optimization_Questionnaire_v2.0.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Questionnaire',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 11, // L
      subScenarioCount: 3,
      questionRows: [3, 11],
      scoringRowOffset: 1,
      complianceColumn: 9, // J
      standardSourceColumn: 10, // K
    },
    kei: { rows: [15, 15], scoringRowOffset: 0, scoringCriteriaColumn: 5, noteRow: [16, 20] },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 11 },
  },
  {
    code: 'RAN_ROUTINE_MAINT_GB1528A',
    name: 'RAN Routine Maintenance',
    networkType: 'RAN',
    hvsCategory: 'Routine Maintenance',
    hasE2ECheck: false,
    fileName: 'GB1528A_RAN_Routine_Maintenance_Questionnaire_V1.0.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Questionnaire',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 10, // K; N = "Other Sub-scenarios" (0.05), kept
      subScenarioCount: 4,
      questionRows: [3, 10],
      scoringRowOffset: 1,
    },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 10 },
  },
  {
    code: 'PROACTIVE_SECURITY_GB1529',
    name: 'Proactive Security',
    networkType: 'Security',
    hvsCategory: 'Proactive Security',
    hasE2ECheck: false,
    fileName: 'GB1529_Proactive_Security_Questionnaire_Template_v1.0.0..xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Questionnaire',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 9, // J; M = "Other sub-scenarios" (0.05), kept
      subScenarioCount: 4,
      questionRows: [3, 11],
      scoringRowOffset: 1,
    },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 9 },
  },
];

// Service layer (batch B). Domains are the service the questionnaire covers.
export const SERVICE_LAYER_REVIEW_QUESTIONNAIRES: ReviewQuestionnaireConfig[] = [
  {
    code: 'SERVICE_DELIVERY_PRIVATE_LINE_GB1502D',
    name: 'Private Line Service Delivery',
    networkType: 'Private Line',
    hvsCategory: 'Service Delivery',
    hasE2ECheck: false,
    fileName: 'GB1502D_Private_Line_Service_Delivery_Questionnaire_V1.0.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Private Line Service Delivery',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 9,
      subScenarioCount: 0, // no answer columns: answered once per question
      questionRows: [3, 11],
      scoringRowOffset: 1,
      scoringTextCheckColumn: 2,
    },
    singleAnswer: true,
    kei: { rows: [16, 19], scoringRowOffset: -1, scoringCriteriaColumn: 5, noteRow: 21 },
    guideline: { kind: 'none' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 9 },
  },
  {
    code: 'SERVICE_ASSURANCE_INDIVIDUAL_GB1503A',
    name: 'Individual Services Service Assurance',
    networkType: 'Individual Services',
    hvsCategory: 'Service Assurance',
    hasE2ECheck: false,
    fileName: 'GB1503A_Individual_Services_Service_Assurance_Questionnaire_v2.0.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Service Assurance Questionnaire',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 10, // K
      subScenarioCount: 3,
      questionRows: [3, 10],
      scoringRowOffset: 1,
      standardSourceColumn: 9, // J
    },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 10 },
  },
  {
    code: 'SERVICE_ASSURANCE_HBB_GB1503B',
    name: 'Home Broadband Service Assurance',
    networkType: 'Home Broadband',
    hvsCategory: 'Service Assurance',
    hasE2ECheck: true,
    fileName: 'GB1503B_Home_Broadband_Service_Assurance_Questionnaire_v2.0.0 (1).xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'HBB Servie Assurance', // sic
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1, // "Stuttering/lag (35%)"
      subScenarioDescriptionRow: 2,
      subScenarioWeightRow: null,
      scoringSubScenarioWeights: { row: 2, columns: [12, 15, 18] },
      subScenarioColumnStart: 13, // N
      subScenarioCount: 3,
      questionRows: [3, 9],
      scoringRowOffset: 1,
      scoringTextCheckColumn: [2, 4], // Service Capability or question text (one is re-worded)
    },
    // The Scoring sheet has no KEI block: A-D scored 4/3/2/1 like every other in-review KEI.
    kei: { rows: [14, 15], scoringRowOffset: 0, scoringCriteriaColumn: 5, noteRow: null, fixedCriteria: { A: 4, B: 3, C: 2, D: 1 } },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 13 },
  },
  {
    code: 'SERVICE_ASSURANCE_IP_PRIVATE_LINE_GB1503H',
    name: 'IP Private Line Service Assurance',
    networkType: 'IP Private Line',
    hvsCategory: 'Service Assurance',
    hasE2ECheck: false,
    fileName: 'GB1503H_IP Private Line_Service Assurance_Questionnaire_v1.0.0.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Service Assurance Questionnaire',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 9, // J — the Scoring sheet only scores this first column
      subScenarioCount: 5,
      questionRows: [3, 10],
      scoringRowOffset: 0,
    },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 9 },
  },
  {
    code: 'COMPLAINT_HANDLING_INDIVIDUAL_GB1504A',
    name: 'Individual Services Complaint Handling',
    networkType: 'Individual Services',
    hvsCategory: 'Complaint Handling',
    hasE2ECheck: false,
    fileName: 'GB1504A_Individual_Services_Complaint_Handling_Questionnaire_v1.1.0_0422(with tracking version).xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Customer Complaint(Clear)',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 9, // J
      subScenarioCount: 3,
      questionRows: [3, 11],
      scoringRowOffset: 1,
    },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 9 },
  },
  {
    code: 'COMPLAINT_HANDLING_HBB_GB1504B',
    name: 'Home Broadband Complaint Handling',
    networkType: 'Home Broadband',
    hvsCategory: 'Complaint Handling',
    hasE2ECheck: true,
    fileName: 'GB1504B_HBB_Complaint_Handling_Questionnaire_v2.0.0_Beta.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'HBB Complaint Handling',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 0, // "No Connectivity\n(Sub-Scenario-1)"
      subScenarioWeightRow: 1,
      subScenarioColumnStart: 13, // N
      subScenarioCount: 3,
      questionRows: [3, 10],
      scoringRowOffset: 1,
      scoringTextCheckColumn: 2,
    },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 13 },
  },
  {
    code: 'SERVICE_FM_INDIVIDUAL_GB1505A',
    name: 'Individual Service Fault Management',
    networkType: 'Individual Services',
    hvsCategory: 'Service Fault Management',
    hasE2ECheck: true,
    fileName: 'GB1505A_Individual_Service_Fault_Management_Questionnaire_v2.0.0NEW NEWNEW.xlsx',
    layout: {
      ...COMMON,
      questionSheet: 'Fault Management',
      scoringSheet: 'Scoring',
      subScenarioNameRow: 1,
      subScenarioWeightRow: 2,
      subScenarioColumnStart: 11, // L
      subScenarioCount: 2,
      questionRows: [3, 10],
      scoringRowOffset: 1,
      scoringTextCheckColumn: [2, 4], // Service Capability or question text (one is re-worded)
      complianceColumn: 9, // J
      standardSourceColumn: 10, // K
    },
    kei: { rows: [17, 18], scoringRowOffset: -1, scoringCriteriaColumn: 5, noteRow: null },
    guideline: { kind: 'standard' },
    demo: { firstQuestionRow: 3, firstSubScenarioColumn: 11 },
  },
];

export function reviewQuestionnairePath(fileName: string): string {
  return repoRootXlsxPath(`${REVIEW_QUESTIONNAIRE_DIR}/${fileName}`);
}

export function parseReviewQuestionnaire(config: ReviewQuestionnaireConfig): ParsedQuestionnaire {
  const fileLabel = config.fileName;
  const workbook = XLSX.readFile(reviewQuestionnairePath(config.fileName));
  const { subScenarios, questions } = readFmSheets(workbook, { fileLabel, ...config.layout });

  let guidelineText: string | null = null;
  let answeringGuidelines = new Map<number, string>();
  if (config.guideline.kind === 'standard') {
    const guideline = readStandardGuideline(workbook, fileLabel, questions);
    guidelineText = guideline.text;
    answeringGuidelines = guideline.answeringGuidelines;
  } else if (config.guideline.kind === 'introduction') {
    const rows = readSheetRows(workbook, config.guideline.sheet, fileLabel);
    guidelineText = joinColumnText(rows, config.guideline.column, [config.guideline.rows]);
  }
  const subScenarioLines = extractNumberedSubScenarioLines((guidelineText ?? '').split('\n\n'));

  return {
    code: config.code,
    name: config.name,
    networkType: config.networkType,
    hvsCategory: config.hvsCategory,
    hasE2ECheck: config.hasE2ECheck,
    inReview: true,
    guidelineText,
    subScenarios: config.singleAnswer
      ? [{ code: 'OVERALL', name: 'Overall', description: '', category: null, faultDistributionWeight: 1, sortOrder: 0 }]
      : subScenarios.map((s) => ({
          ...s,
          description: subScenarioLines.get(s.sortOrder + 1) ?? s.description,
        })),
    questions: questions.map((q) => ({
      ...q,
      answeringGuideline: answeringGuidelines.get(q.sortOrder) ?? null,
    })),
    ...(config.kei
      ? readKeis(workbook, {
          fileLabel,
          questionSheet: config.layout.questionSheet,
          scoringSheet: config.layout.scoringSheet,
          ...config.kei,
        })
      : { effectivenessIndicators: [], keiNote: null }),
  };
}

export const REVIEW_QUESTIONNAIRES = [
  ...NETWORK_LAYER_REVIEW_QUESTIONNAIRES,
  ...SERVICE_LAYER_REVIEW_QUESTIONNAIRES,
];

export function parseReviewQuestionnaires(): ParsedQuestionnaire[] {
  return REVIEW_QUESTIONNAIRES.map(parseReviewQuestionnaire);
}
