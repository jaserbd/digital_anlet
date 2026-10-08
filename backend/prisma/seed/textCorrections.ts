import type { ParsedQuestionnaire } from './parsedQuestionnaire.types';

// Spelling / spacing / grammar corrections to the TM Forum source workbooks (SPELLING_PLAN.md),
// applied between parsing and seeding so the xlsx files stay untouched as the original source.
// Scope (product decision): real typos, spacing/punctuation and clear word errors only — never a
// change of meaning or a rewrite of the source wording; British/American spelling is left as in
// the source (fulfilment/fulfillment, unauthorised). Sub-scenario names are never touched: their
// codes are derived from the name and key existing answers.
//
// Every fix must still match its source text — textCorrections.test.ts fails otherwise, so a
// revised workbook that already fixes something gets the entry removed rather than left stale.

export type CorrectionKind = 'spelling' | 'grammar' | 'spacing';

export interface TextCorrection {
  find: string;
  replace: string;
  kind: CorrectionKind;
  /** Questionnaire codes this applies to; omitted = every questionnaire. */
  only?: string[];
}

const IP = 'IP_FM_GB1523E';
const MW = 'TRANSPORT_MW_FM_GB1523D';
const OTN = 'TRANSPORT_OTN_FM_GB1523D';
const FA = 'FIXED_ACCESS_FM_GB1523C';
const CORE_FM = 'CORE_FM_GB1059B';
const CORE_STAB = 'CORE_STABILITY_GB1059B';

// Applied in order, each to every occurrence, after normalizeSpacing — so `find` strings use
// single spaces and ASCII punctuation.
export const TEXT_CORRECTIONS: TextCorrection[] = [
  // --- Spelling
  { find: 'Sub-scenairo', replace: 'Sub-scenario', kind: 'spelling' },
  { find: 'identifty', replace: 'identify', kind: 'spelling' },
  { find: 'The system identity faults', replace: 'The system identifies faults', kind: 'spelling' },
  { find: 'intructions', replace: 'instructions', kind: 'spelling' },
  { find: 'petential', replace: 'potential', kind: 'spelling' },
  { find: 'milisecond', replace: 'millisecond', kind: 'spelling' },
  { find: 'serive', replace: 'service', kind: 'spelling' },
  { find: 'unaccessable', replace: 'inaccessible', kind: 'spelling' },
  { find: 'nonconsequential', replace: 'inconsequential', kind: 'spelling' },
  { find: 'fileting', replace: 'filtering', kind: 'spelling' },
  { find: 'programable', replace: 'programmable', kind: 'spelling' },
  { find: 'Programable', replace: 'Programmable', kind: 'spelling' },
  { find: 'IDO/ODU', replace: 'IDU/ODU', kind: 'spelling' },
  { find: 'based on AL modes', replace: 'based on AI models', kind: 'spelling' },
  { find: 'using intelligent AI mode.', replace: 'using intelligent AI models.', kind: 'spelling' },
  { find: 'nature language', replace: 'natural language', kind: 'spelling' },
  { find: 'Nature Language', replace: 'Natural Language', kind: 'spelling' },
  { find: 'NF healthy status check', replace: 'NF health status check', kind: 'spelling' },
  { find: 'check list', replace: 'checklist', kind: 'spelling' },
  { find: 'ITU-T G873.1', replace: 'ITU-T G.873.1', kind: 'spelling' },
  { find: 'Demarcation and locating Ratio', replace: 'Demarcation and Locating Ratio', kind: 'spelling' },
  { find: 'recovery of fault rectification solution', replace: 'recovery or fault rectification solution', kind: 'spelling' },
  { find: 'recovery of Microwave fault rectification solution', replace: 'recovery or Microwave fault rectification solution', kind: 'spelling' },
  { find: '"The system locates the single root cause', replace: 'The system locates the single root cause', kind: 'spelling', only: [FA] },

  // --- Spacing / punctuation
  { find: 'Data Collection& Alarm', replace: 'Data Collection & Alarm', kind: 'spacing' },
  { find: 'Identification ,Risk', replace: 'Identification, Risk', kind: 'spacing' },
  { find: 'O&M.The', replace: 'O&M. The', kind: 'spacing' },
  { find: 'restoration.Verification', replace: 'restoration. Verification', kind: 'spacing' },
  { find: 'link down),caused', replace: 'link down), caused', kind: 'spacing' },
  { find: 'bandwidth limit,etc.', replace: 'bandwidth limit, etc.', kind: 'spacing' },
  { find: 'pigtails fall off. etc.', replace: 'pigtails fall off, etc.', kind: 'spacing' },
  { find: '(i.e, ', replace: '(i.e. ', kind: 'spacing' },
  { find: 'e.g, ', replace: 'e.g. ', kind: 'spacing' },
  { find: 'Faults,potential', replace: 'Faults, potential', kind: 'spacing' },
  { find: 'by tool,but', replace: 'by tools, but', kind: 'spacing' },
  { find: 'expertise(such as', replace: 'expertise (such as', kind: 'spacing' },
  { find: 'solution(Automatic', replace: 'solution (Automatic', kind: 'spacing' },
  { find: 'Otherwise(automatic', replace: 'Otherwise (automatic', kind: 'spacing' },
  { find: 'Recovery(MTTR)', replace: 'Recovery (MTTR)', kind: 'spacing' },
  { find: 'Repair(MTTR)', replace: 'Repair (MTTR)', kind: 'spacing' },
  { find: 'multipath(Signal', replace: 'multipath (Signal', kind: 'spacing' },
  { find: 'reflections /signal', replace: 'reflections/signal', kind: 'spacing' },
  { find: 'commands/ scripts', replace: 'commands/scripts', kind: 'spacing' },
  { find: 'root cause/ total', replace: 'root cause / total', kind: 'spacing' },
  { find: 'T2/ (Total', replace: 'T2 / (Total', kind: 'spacing' },
  { find: 'cloud OS ((VMs or pods)', replace: 'cloud OS (VMs or pods)', kind: 'spacing' },
  { find: 'auxiliary tools ((e.g.,', replace: 'auxiliary tools (e.g.,', kind: 'spacing' },
  { find: '-RN(splitter)', replace: '- RN (splitter)', kind: 'spacing' },
  { find: 'RN(splitter)', replace: 'RN (splitter)', kind: 'spacing' },
  { find: 'estimated fiber distance', replace: 'estimated fiber distance)', kind: 'spacing', only: [FA] },
  { find: 'alarm correlations/knowledge graph).', replace: 'alarm correlations/knowledge graph.', kind: 'spacing', only: [FA] },
  { find: 'customized troubleshooting preference, 2)', replace: 'customized troubleshooting preference), 2)', kind: 'spacing', only: [OTN] },
  { find: 'automatically, e.g. alarms, power, weather)', replace: 'automatically (e.g. alarms, power, weather)', kind: 'spacing' },
  { find: 'Sub-scenario-1:Equipment:', replace: 'Sub-scenario-1: Equipment:', kind: 'spacing' },
  { find: 'Sub-scenario-2:', replace: 'Sub-scenario-2: ', kind: 'spacing' },
  { find: 'Sub-scenario-3:', replace: 'Sub-scenario-3: ', kind: 'spacing' },
  { find: 'Sub-scenario-4:Environmental', replace: 'Sub-scenario-4: Environmental', kind: 'spacing' },
  { find: 'Sub-scenario-5:Security', replace: 'Sub-scenario-5: Security', kind: 'spacing' },
  { find: '\n1)The ', replace: '\n1) The ', kind: 'spacing' },
  { find: '\n2)The ', replace: '\n2) The ', kind: 'spacing' },
  { find: '\n2)For ', replace: '\n2) For ', kind: 'spacing' },
  { find: 'are listed as follows,', replace: 'are listed as follows:', kind: 'spacing' },
  { find: '<1hour', replace: '<1 hour', kind: 'spacing' },
  { find: '>1hour, <=4hour', replace: '>1 hour, <=4 hours', kind: 'spacing' },
  { find: '>4hour', replace: '>4 hours', kind: 'spacing' },
  { find: '<=1hour', replace: '<=1 hour', kind: 'spacing' },
  { find: '>1hour', replace: '>1 hour', kind: 'spacing' },
  { find: '<=8 hour', replace: '<=8 hours', kind: 'spacing' },
  { find: '<=10hour', replace: '<=10 hours', kind: 'spacing' },
  { find: '>8 hour', replace: '>8 hours', kind: 'spacing' },
  { find: '>10hour', replace: '>10 hours', kind: 'spacing' },
  { find: '<=12 hour', replace: '<=12 hours', kind: 'spacing' },
  { find: '<=24hour', replace: '<=24 hours', kind: 'spacing' },
  { find: '>12 hour', replace: '>12 hours', kind: 'spacing' },
  { find: '>24hour', replace: '>24 hours', kind: 'spacing' },

  // --- Grammar / clear word errors
  { find: 'should include but not limit to', replace: 'should include but not be limited to', kind: 'grammar' },
  { find: 'Should include but not limit to', replace: 'Should include but not be limited to', kind: 'grammar' },
  { find: 'process required conveying information', replace: 'process required for conveying information', kind: 'grammar' },
  { find: 'with a security attack has been detected', replace: 'with a security attack that has been detected', kind: 'grammar' },
  { find: 'the system determine the fault management targets', replace: 'the system determines the fault management targets', kind: 'grammar' },
  { find: 'is possible, Any need', replace: 'is possible; any need', kind: 'grammar' },
  { find: '(If case of VNF, it is the failure occurs on the infrastructure hardware resource that host the VNF)', replace: '(In case of VNF, it is the failure that occurs on the infrastructure hardware resource that hosts the VNF)', kind: 'grammar', only: [CORE_FM] },
  { find: 'in multiple vendor environment, the evidences', replace: 'in a multi-vendor environment, the evidence', kind: 'grammar' },
  { find: 'in multiple vendor scenario', replace: 'in a multi-vendor scenario', kind: 'grammar' },
  { find: 'demarcation of following scenarios', replace: 'demarcation of the following scenarios', kind: 'grammar' },
  { find: 'covering 80% or higher faults', replace: 'covering 80% or higher of faults', kind: 'grammar' },
  { find: 'based on specialized checklist', replace: 'based on a specialized checklist', kind: 'grammar' },
  { find: "user-plane NE's pool-based", replace: "user-plane NEs' pool-based", kind: 'grammar' },
  { find: 'is capable to keep', replace: 'is capable of keeping', kind: 'grammar' },
  { find: 'impacts of user-plane NEs faults', replace: 'impacts of user-plane NE faults', kind: 'grammar' },
  { find: 'network can fallback without', replace: 'network can fall back without', kind: 'grammar' },
  { find: 'and remain data connection alive', replace: 'and keep the data connection alive', kind: 'grammar' },
  { find: 'are capable to protect its processing capability', replace: 'are capable of protecting their processing capability', kind: 'grammar' },
  { find: 'are capable to evaluate and adjust', replace: 'are capable of evaluating and adjusting', kind: 'grammar' },
  { find: 'requires periodically manual confirmation', replace: 'requires periodic manual confirmation', kind: 'grammar', only: [CORE_STAB] },
  { find: 'alarms correlation', replace: 'alarm correlation', kind: 'grammar' },
  { find: 'including automatically fault-handling results and the suggestions for faults that required manually handling', replace: 'including automatic fault-handling results and the suggestions for faults that require manual handling', kind: 'grammar' },
  { find: 'may needs human confirmation', replace: 'may need human confirmation', kind: 'grammar' },
  { find: 'manual written procedures', replace: 'manually written procedures', kind: 'grammar' },
  { find: 'need manually confirmation', replace: 'need manual confirmation', kind: 'grammar' },
  { find: 'the faults that on-site handling is necessary', replace: 'the faults for which on-site handling is necessary', kind: 'grammar' },
  { find: 'The system support intelligent', replace: 'The system supports intelligent', kind: 'grammar' },
  { find: 'The on-site handling are assisted', replace: 'The on-site handling is assisted', kind: 'grammar' },
  { find: 'The recovery solution need to be', replace: 'The recovery solution needs to be', kind: 'grammar' },
  { find: 'in ticket system,', replace: 'in the ticket system,', kind: 'grammar', only: [IP] },
  { find: 'the valid field that represent automatic', replace: 'the valid field that represents automatic', kind: 'grammar', only: [IP] },
  { find: 'autonomous system that display the summary', replace: 'autonomous system that displays the summary', kind: 'grammar', only: [IP] },
  { find: 'in a period more than 1 month', replace: 'in a period of more than 1 month', kind: 'grammar', only: [IP] },
  { find: 'in a period more 1 month', replace: 'in a period of more than 1 month', kind: 'grammar', only: [IP] },
  { find: 'solutions, Dynamically Programmable Rules', replace: 'solutions using Dynamically Programmable Rules', kind: 'grammar' },
  { find: 'to be executed Dynamically Programmable Rules', replace: 'to be executed using Dynamically Programmable Rules', kind: 'grammar', only: [FA] },
  { find: 'then filter repeated', replace: 'then filters repeated', kind: 'grammar' },
  { find: 'then filter duplicate', replace: 'then filters duplicate', kind: 'grammar' },
  { find: '(i.e. elimination of invalid, & repeated)', replace: '(i.e. elimination of invalid & repeated alarms)', kind: 'grammar', only: [MW] },
  { find: 'request system to monitoring and handling the fault', replace: 'request the system to monitor and handle the fault', kind: 'grammar', only: [OTN] },
  { find: 'analyze a specific fault occurred in', replace: 'analyze a specific fault that occurred in', kind: 'grammar', only: [OTN] },
  { find: 'The system manually identify potential risks', replace: 'The system manually identifies potential risks', kind: 'grammar', only: [OTN] },
  { find: 'identify faults, and subsequent impacts', replace: 'identify faults and subsequent impacts', kind: 'grammar', only: [OTN] },
  { find: 'The system automatically also evaluates', replace: 'The system also automatically evaluates', kind: 'grammar', only: [OTN] },
  { find: 'fault repair solution to for execution', replace: 'fault repair solution for execution', kind: 'grammar', only: [OTN] },
  { find: 'CSP provide the trouble ticket information', replace: 'CSP provides the trouble ticket information', kind: 'grammar', only: [OTN] },
  { find: 'Each of the trouble ticket needs to recorded with', replace: 'Each trouble ticket needs to be recorded with', kind: 'grammar', only: [OTN] },
  { find: 'data collection, alarm correlation and filtering? (alarms, logs, configuration, performance/OAM) and alarm filtering/correlation?', replace: 'data collection (alarms, logs, configuration, performance/OAM) and alarm filtering/correlation?', kind: 'grammar', only: [FA] },
  { find: 'support fault Locating and root cause locating', replace: 'support fault locating and root cause locating', kind: 'grammar', only: [FA] },
];

// Generic spacing clean-up, applied before the list above: collapses repeated spaces inside a
// line, drops spaces before closing punctuation and trailing spaces, and turns non-breaking
// spaces and full-width (CJK) punctuation into plain ASCII. Leading indentation and line breaks are kept.
export function normalizeSpacing(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/：/g, ': ')
    .replace(/，/g, ', ')
    .replace(/（/g, ' (')
    .replace(/(\S)[ \t]{2,}(?=\S)/g, '$1 ')
    .replace(/(\S)[ \t]+([,.?;:)])(?=\s|$)/g, '$1$2')
    .replace(/\( +/g, '(')
    .replace(/[ \t]+(?=\r?\n|$)/g, '')
    .replace(/^ \(/gm, '(');
}

export function correctText(text: string, code: string, matches?: Map<TextCorrection, number>): string {
  let result = normalizeSpacing(text);
  for (const c of TEXT_CORRECTIONS) {
    if (c.only && !c.only.includes(code)) continue;
    const parts = result.split(c.find);
    if (parts.length > 1) {
      matches?.set(c, (matches.get(c) ?? 0) + parts.length - 1);
      result = parts.join(c.replace);
    }
  }
  // Once more, for any double space a fix itself produced.
  return normalizeSpacing(result);
}

// Applies the corrections to every displayed text field of a parsed questionnaire. Sub-scenario
// names are left alone (see header); everything else — names, guideline text, notes,
// sub-scenario descriptions, question/option/guidance text, KEIs — is corrected.
export function applyTextCorrections(
  parsed: ParsedQuestionnaire,
  matches?: Map<TextCorrection, number>,
): ParsedQuestionnaire {
  const fix = (t: string) => correctText(t, parsed.code, matches);
  const fixNullable = (t: string | null) => (t == null ? t : fix(t));
  const fixOptions = <T extends Partial<Record<string, string>>>(o: T): T =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v == null ? v : fix(v)])) as T;

  return {
    ...parsed,
    name: fix(parsed.name),
    hvsCategory: fix(parsed.hvsCategory),
    guidelineText: fixNullable(parsed.guidelineText),
    keiNote: fixNullable(parsed.keiNote),
    subScenarios: parsed.subScenarios.map((s) => ({ ...s, description: fix(s.description) })),
    questions: parsed.questions.map((q) => ({
      ...q,
      cognitiveActivity: fix(q.cognitiveActivity),
      serviceCapability: fix(q.serviceCapability),
      questionText: fix(q.questionText),
      optionText: fixOptions(q.optionText),
      answeringGuideline: fixNullable(q.answeringGuideline),
    })),
    effectivenessIndicators: parsed.effectivenessIndicators.map((k) => ({
      ...k,
      name: fix(k.name),
      description: fix(k.description),
      optionText: fixOptions(k.optionText),
    })),
  };
}
