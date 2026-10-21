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

// In-review "(R)" questionnaires (REVIEW_SPELLING_PLAN.md), named by their TM Forum document number.
const GB1521E = 'IP_PLANNING_GB1521E';
const GB1522A = 'RAN_DEPLOYMENT_GB1522A';
const GB1522B = 'CORE_DEPLOYMENT_GB1522B';
const GB1524A = 'RAN_CHANGE_MGMT_GB1524A';
const GB1524B = 'CORE_CHANGE_MGMT_GB1524B';
const GB1524E = 'IP_CHANGE_MGMT_GB1524E';
const GB1525A = 'RAN_QUALITY_OPT_GB1525A';
const GB1525D = 'TRANSPORT_OTN_QUALITY_OPT_GB1525D';
const GB1525E = 'IP_QUALITY_OPT_GB1525E';
const GB1526A = 'RAN_ENERGY_EFF_GB1526A';
const GB1528A = 'RAN_ROUTINE_MAINT_GB1528A';
const GB1529 = 'PROACTIVE_SECURITY_GB1529';
const GB1502D = 'SERVICE_DELIVERY_PRIVATE_LINE_GB1502D';
const GB1503A = 'SERVICE_ASSURANCE_INDIVIDUAL_GB1503A';
const GB1503B = 'SERVICE_ASSURANCE_HBB_GB1503B';
const GB1503H = 'SERVICE_ASSURANCE_IP_PRIVATE_LINE_GB1503H';
const GB1504A = 'COMPLAINT_HANDLING_INDIVIDUAL_GB1504A';
const GB1505A = 'SERVICE_FM_INDIVIDUAL_GB1505A';

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

  // --- In-review questionnaires: spelling
  { find: 'Home bBroadband', replace: 'Home Broadband', kind: 'spelling', only: [GB1503B] },
  { find: 'Automatiion', replace: 'Automation', kind: 'spelling', only: [GB1503B] },
  { find: 'Some issus may', replace: 'Some issues may', kind: 'spelling', only: [GB1503B] },
  { find: 'video conferening', replace: 'video conferencing', kind: 'spelling', only: [GB1503B] },
  { find: 'behanivour', replace: 'behaviour', kind: 'spelling', only: [GB1503A] },
  { find: 'alliviate', replace: 'alleviate', kind: 'spelling', only: [GB1503H] },
  { find: 'guaranteee', replace: 'guarantee', kind: 'spelling', only: [GB1503H] },
  { find: 'Core problem transimission problem ,OTT problem', replace: 'Core problem, transmission problem, OTT problem', kind: 'spelling', only: [GB1504A] },
  { find: 'who may complaint due to', replace: 'who may complain due to', kind: 'spelling', only: [GB1504A] },
  { find: 'anomal event', replace: 'anomalous event', kind: 'spelling', only: [GB1505A] },
  { find: 'fault occured', replace: 'fault occurred', kind: 'spelling', only: [GB1505A] },
  { find: 'requirment', replace: 'requirement', kind: 'spelling', only: [GB1524B] },
  { find: 'excuted', replace: 'executed', kind: 'spelling', only: [GB1524B] },
  { find: 'manually defines rules', replace: 'manually defined rules', kind: 'spelling', only: [GB1524A, GB1524B, GB1524E] },
  { find: 'ETST ENI035', replace: 'ETSI GR ENI 035', kind: 'spelling', only: [GB1524E] },
  { find: 'optimiztaion', replace: 'optimization', kind: 'spelling', only: [GB1525A] },
  { find: 'coverge hole, overlapped cell,overshoot', replace: 'coverage hole, overlapped cell, overshoot', kind: 'spelling', only: [GB1525A] },
  { find: 'not limiited to', replace: 'not limited to', kind: 'spelling', only: [GB1525A] },
  { find: '>4 hourss', replace: '>4 hours', kind: 'spelling', only: [GB1525A] },
  { find: 'high load, inference and equipment fault', replace: 'high load, interference and equipment fault', kind: 'spelling', only: [GB1525A] },
  { find: 'serveral', replace: 'several', kind: 'spelling', only: [GB1525E] },
  { find: 'capabitlities', replace: 'capabilities', kind: 'spelling', only: [GB1525E] },
  { find: 'questionnarie', replace: 'questionnaire', kind: 'spelling', only: [GB1525E] },
  { find: 'Network KPI inculde', replace: 'Network KPIs include', kind: 'spelling', only: [GB1525E] },
  { find: 'eveluates', replace: 'evaluates', kind: 'spelling', only: [GB1525E] },
  { find: 'quaity', replace: 'quality', kind: 'spelling', only: [GB1525E] },
  { find: '(e.g., ifit, iOAM)', replace: '(e.g., IFIT, iOAM)', kind: 'spelling', only: [GB1525E] },
  { find: 'Other Subscenario', replace: 'Other Sub-scenario', kind: 'spelling', only: [GB1525E] },
  { find: 'subscenario', replace: 'sub-scenario', kind: 'spelling', only: [GB1525E] },
  { find: 'indicactor', replace: 'indicator', kind: 'spelling', only: [GB1526A] },
  { find: 'Intent gardrails', replace: 'Intent guardrails', kind: 'spelling', only: [GB1526A] },
  { find: '(e..g, cell)', replace: '(e.g. cell)', kind: 'spelling', only: [GB1526A] },
  { find: 'energy savings actions', replace: 'energy saving actions', kind: 'spelling', only: [GB1526A] },
  { find: 'remotely peformed', replace: 'remotely performed', kind: 'spelling', only: [GB1528A] },
  { find: 'Maintenace', replace: 'Maintenance', kind: 'spelling', only: [GB1528A] },
  { find: 'deviaiton', replace: 'deviation', kind: 'spelling', only: [GB1528A] },
  { find: 'confrmation', replace: 'confirmation', kind: 'spelling', only: [GB1528A] },
  { find: 'identifiying', replace: 'identifying', kind: 'spelling', only: [GB1529] },
  { find: 'Traffic infos', replace: 'Traffic info', kind: 'spelling', only: [GB1529] },
  { find: 'To what extend the System', replace: 'To what extent the System', kind: 'spelling', only: [GB1529] },
  { find: 'find-out', replace: 'find out', kind: 'spelling', only: [GB1529] },
  { find: 'is dependant on', replace: 'is dependent on', kind: 'spelling', only: [GB1522A] },
  { find: 'and mare require', replace: 'and may require', kind: 'spelling', only: [GB1522A] },
  { find: 'and my need Human', replace: 'and may need Human', kind: 'spelling', only: [GB1524A] },
  { find: 'underlaying', replace: 'underlying', kind: 'spelling', only: [GB1525D] },
  { find: 'quality got promoted', replace: 'quality got improved', kind: 'spelling', only: [GB1525E] },
  { find: ' and or ', replace: ' and/or ', kind: 'spelling', only: [GB1522A] },
  // --- In-review questionnaires: spacing / punctuation
  { find: 'upgrade、NEs', replace: 'upgrade, NEs', kind: 'spacing', only: [GB1524B] },
  { find: 'fulfilment？', replace: 'fulfilment?', kind: 'spacing', only: [GB1525A] },
  { find: 'capability）× 100%', replace: 'capability) × 100%', kind: 'spacing', only: [GB1525A] },
  { find: 'implemented,assisted', replace: 'implemented, assisted', kind: 'spacing', only: [GB1525A] },
  { find: 'actions).The system', replace: 'actions). The system', kind: 'spacing', only: [GB1525A] },
  { find: 'deterioration,VoLTE', replace: 'deterioration, VoLTE', kind: 'spacing', only: [GB1503A] },
  { find: 'cases.The System', replace: 'cases. The System', kind: 'spacing', only: [GB1504A] },
  { find: '(B)The System', replace: '(B) The System', kind: 'spacing', only: [GB1504A] },
  { find: '(A)The system', replace: '(A) The system', kind: 'spacing', only: [GB1504A] },
  { find: 'contextualizes ...In this context', replace: 'contextualizes... In this context', kind: 'spacing', only: [GB1504A] },
  { find: 'sentiment .. It links', replace: 'sentiment. It links', kind: 'spacing', only: [GB1504A] },
  { find: 'multi channel', replace: 'multi-channel', kind: 'spacing', only: [GB1504A] },
  { find: 'Multi channel', replace: 'Multi-channel', kind: 'spacing', only: [GB1504A] },
  { find: 'architecture(physical', replace: 'architecture (physical', kind: 'spacing', only: [GB1521E] },
  { find: 'environments(e.g.', replace: 'environments (e.g.', kind: 'spacing', only: [GB1521E] },
  { find: 'solutions(plans)', replace: 'solutions (plans)', kind: 'spacing', only: [GB1521E] },
  { find: 'package(topology, capacity and etc.)', replace: 'package (topology, capacity, etc.)', kind: 'spacing', only: [GB1521E] },
  { find: 'etc.),,', replace: 'etc.),', kind: 'spacing', only: [GB1521E] },
  { find: 'multi vendor', replace: 'multi-vendor', kind: 'spacing', only: [GB1521E] },
  { find: '1)Parameter', replace: '1) Parameter', kind: 'spacing', only: [GB1524A] },
  { find: 'Updates& Patches', replace: 'Updates & Patches', kind: 'spacing', only: [GB1524A] },
  { find: 'Intent Translation, & Intent Fulfilment', replace: 'Intent Translation & Intent Fulfilment', kind: 'spacing', only: [GB1524A] },
  { find: 'NEs /associated', replace: 'NEs/associated', kind: 'spacing', only: [GB1524B] },
  { find: 'templates..', replace: 'templates.', kind: 'spacing', only: [GB1524B] },
  { find: 'inspection).E.g.:', replace: 'inspection). E.g.:', kind: 'spacing', only: [GB1524B] },
  { find: '1.Normal', replace: '1. Normal', kind: 'spacing', only: [GB1524E] },
  { find: '2.Emergency', replace: '2. Emergency', kind: 'spacing', only: [GB1524E] },
  { find: '3.Expedited', replace: '3. Expedited', kind: 'spacing', only: [GB1524E] },
  { find: 'meeting);4.Standard', replace: 'meeting); 4. Standard', kind: 'spacing', only: [GB1524E] },
  { find: 'follow a standard procedure.', replace: 'follow a standard procedure).', kind: 'spacing', only: [GB1524E] },
  { find: 'Sub-scenario-1. Device', replace: 'Sub-scenario-1: Device', kind: 'spacing', only: [GB1524E] },
  { find: 'Provisioning :add', replace: 'Provisioning: add', kind: 'spacing', only: [GB1524E] },
  { find: 'Note4;', replace: 'Note4:', kind: 'spacing', only: [GB1524E] },
  { find: 'evaluation& Decision', replace: 'evaluation & Decision', kind: 'spacing', only: [GB1524E] },
  { find: '(1)online', replace: '(1) online', kind: 'spacing', only: [GB1524E] },
  { find: 'intervention..', replace: 'intervention.', kind: 'spacing', only: [GB1524E] },
  { find: 'roll-back(if', replace: 'roll-back (if', kind: 'spacing', only: [GB1524E] },
  { find: 'actions(such as', replace: 'actions (such as', kind: 'spacing', only: [GB1525D] },
  { find: 'flows(e.g.', replace: 'flows (e.g.', kind: 'spacing', only: [GB1525E] },
  { find: 'degradation(e.g.', replace: 'degradation (e.g.', kind: 'spacing', only: [GB1525E] },
  { find: 'AI Models ,without human intervention(e.g.', replace: 'AI Models, without human intervention (e.g.', kind: 'spacing', only: [GB1525E] },
  { find: 'verification(e.g.', replace: 'verification (e.g.', kind: 'spacing', only: [GB1525E] },
  { find: 'FRR(Fast reroute)', replace: 'FRR (Fast reroute)', kind: 'spacing', only: [GB1525E] },
  { find: 'network/ service', replace: 'network/service', kind: 'spacing', only: [GB1525E] },
  { find: '<= 30min', replace: '<= 30 min', kind: 'spacing', only: [GB1525E] },
  { find: '>30min, <= 2hour', replace: '>30 min, <= 2 hours', kind: 'spacing', only: [GB1525E] },
  { find: '>2hour', replace: '>2 hours', kind: 'spacing', only: [GB1525E] },
  { find: 'type(e.g.', replace: 'type (e.g.', kind: 'spacing', only: [GB1503H] },
  { find: 'requirement(e.g.', replace: 'requirement (e.g.', kind: 'spacing', only: [GB1503H] },
  { find: 'severity/ priority', replace: 'severity/priority', kind: 'spacing', only: [GB1503H] },
  { find: 'congestion/ give', replace: 'congestion/give', kind: 'spacing', only: [GB1503H] },
  { find: 'analysis(RCA) should within', replace: 'analysis (RCA) should be within', kind: 'spacing', only: [GB1503H] },
  { find: 'Ticket(TT)', replace: 'Ticket (TT)', kind: 'spacing', only: [GB1505A] },
  { find: 'Sub-scenario-1:Service', replace: 'Sub-scenario-1: Service', kind: 'spacing', only: [GB1505A] },
  { find: '> 1 hour, < 4 hour', replace: '> 1 hour, < 4 hours', kind: 'spacing', only: [GB1505A] },
  { find: '> = 4 hour', replace: '>= 4 hours', kind: 'spacing', only: [GB1505A] },
  { find: '> = 8 hour', replace: '>= 8 hours', kind: 'spacing', only: [GB1505A] },
  { find: 'On site recovery', replace: 'On-site recovery', kind: 'spacing', only: [GB1505A] },
  { find: 'etc..', replace: 'etc.', kind: 'spacing', only: [GB1503B] },
  { find: 'And MEF LSO', replace: 'and MEF LSO', kind: 'spacing', only: [GB1503B] },
  { find: 'issues×Total', replace: 'issues × Total', kind: 'spacing', only: [GB1503B] },
  { find: 'capability)× 100%', replace: 'capability) × 100%', kind: 'spacing', only: [GB1503B] },
  { find: '(e.g. throughput and latency).', replace: '(e.g. throughput and latency)?', kind: 'spacing', only: [GB1503B] },
  { find: 'severity of service degradation)', replace: 'severity of service degradation)?', kind: 'spacing', only: [GB1503B] },
  { find: '[ performance', replace: '[performance', kind: 'spacing', only: [GB1503A] },
  { find: '[ Represent how', replace: '[represents how', kind: 'spacing', only: [GB1503A] },
  { find: '(ex for data quality check ...)', replace: '(e.g. for data quality checks)', kind: 'spacing', only: [GB1526A] },
  { find: '(e.g memory clearing .....)', replace: '(e.g. memory clearing...)', kind: 'spacing', only: [GB1528A] },
  { find: 'Software level & features,)', replace: 'Software level & features)', kind: 'spacing', only: [GB1528A] },
  { find: 'How Does the System', replace: 'How does the System', kind: 'spacing', only: [GB1528A] },
  { find: '(e.g: policies, rules, actions ...).', replace: '(e.g. policies, rules, actions...)?', kind: 'spacing', only: [GB1529] },
  { find: 'Sub-scenario1:', replace: 'Sub-scenario 1:', kind: 'spacing', only: [GB1529] },
  { find: 'Sub-scenario2:', replace: 'Sub-scenario 2:', kind: 'spacing', only: [GB1529] },
  { find: 'Sub-scenario3:', replace: 'Sub-scenario 3:', kind: 'spacing', only: [GB1529] },
  { find: 'such as SLA monitoring', replace: 'such as SLA monitoring?', kind: 'spacing', only: [GB1502D] },
  { find: 'statistical period ] /', replace: 'statistical period /', kind: 'spacing', only: [GB1502D] },
  { find: 'performance /service', replace: 'performance/service', kind: 'spacing', only: [GB1525A] },
  { find: 'reflects the objective customer experience,', replace: 'reflects the objective customer experience.', kind: 'spacing', only: [GB1503B] },
  // --- In-review questionnaires: grammar / clear word errors
  { find: 'Planning system that support the process', replace: 'Planning system that supports the process', kind: 'grammar', only: [GB1521E] },
  { find: 'in autonomous way', replace: 'in an autonomous way', kind: 'grammar', only: [GB1521E] },
  { find: 'AI models correlates', replace: 'AI models correlate', kind: 'grammar', only: [GB1521E] },
  { find: 'support generation plan (design', replace: 'support generation of plan (design', kind: 'grammar', only: [GB1521E] },
  { find: 'the planning system automatically generates the planning documents', replace: 'The planning system automatically generates the planning documents', kind: 'grammar', only: [GB1521E] },
  { find: 'the planning system automatically generate documents package', replace: 'The planning system automatically generates the documents package', kind: 'grammar', only: [GB1521E] },
  { find: 'with human assistant', replace: 'with human assistance', kind: 'grammar', only: [GB1521E] },
  { find: 'the plan documents are made by human', replace: 'The plan documents are made by humans', kind: 'grammar', only: [GB1521E] },
  { find: 'related policies and evaluates the Fulfillment', replace: 'related policies and evaluate the Fulfillment', kind: 'grammar', only: [GB1522A, GB1522B] },
  { find: 'control information are manually defined', replace: 'control information is manually defined', kind: 'grammar', only: [GB1522A] },
  { find: 'control information are manually defined', replace: 'control information is manually defined', kind: 'grammar', only: [GB1526A] },
  { find: 'related information are collected', replace: 'related information is collected', kind: 'grammar', only: [GB1526A] },
  { find: 'collected and translated it into input', replace: 'collected and translated into input', kind: 'grammar', only: [GB1522A] },
  { find: 'there is enough available resources', replace: 'there are enough available resources', kind: 'grammar', only: [GB1522A] },
  { find: 'in case they found differences', replace: 'in case they find differences', kind: 'grammar', only: [GB1522A] },
  { find: 'but its the optimal', replace: "but it's the optimal", kind: 'grammar', only: [GB1522A, GB1522B] },
  { find: 'in case of multiple options/solutions are targeted', replace: 'in case multiple options/solutions are targeted', kind: 'grammar', only: [GB1522A] },
  { find: 'to automatically executes', replace: 'to automatically execute', kind: 'grammar', only: [GB1522A] },
  { find: 'The System ensured', replace: 'The System ensures', kind: 'grammar', only: [GB1522A] },
  { find: 'supports commissioning & ensure acceptable', replace: 'supports commissioning & ensures acceptable', kind: 'grammar', only: [GB1522A] },
  { find: 'requires require Human', replace: 'requires Human', kind: 'grammar', only: [GB1522A] },
  { find: 'recommended to go this questionnaire', replace: 'recommended to go through this questionnaire', kind: 'grammar', only: [GB1522A] },
  { find: 'present to correlates & validates', replace: 'present to correlate & validate', kind: 'grammar', only: [GB1522B] },
  { find: 'its able to adjust in case its found differences', replace: "it's able to adjust in case it finds differences", kind: 'grammar', only: [GB1522B] },
  { find: 'Run Book Automations requires further', replace: 'Run Book Automations and require further', kind: 'grammar', only: [GB1522B] },
  { find: 'was considered reaching its top score', replace: 'was considered to reach its top score', kind: 'grammar', only: [GB1522B] },
  { find: 'Service Capabilities who are not available, require consensus', replace: 'Service Capabilities that are not available require consensus', kind: 'grammar', only: [GB1524A] },
  { find: 'Prior to set the Intent', replace: 'Prior to setting the Intent', kind: 'grammar', only: [GB1524A, GB1524B] },
  { find: 'impacts and evaluate subsequent risk', replace: 'impacts and evaluates subsequent risk', kind: 'grammar', only: [GB1524A, GB1524B] },
  { find: 'changes that has been', replace: 'changes that have been', kind: 'grammar', only: [GB1524A] },
  { find: 'includes but not limited to', replace: 'includes but is not limited to', kind: 'grammar', only: [GB1524B, GB1525E, GB1526A] },
  { find: 'include but not limited to', replace: 'include but are not limited to', kind: 'grammar', only: [GB1525E, GB1526A] },
  { find: 'The root causes including but not limited to', replace: 'The root causes include but are not limited to', kind: 'grammar', only: [GB1525A] },
  { find: 'solutions including but not limited to', replace: 'solutions include but are not limited to', kind: 'grammar', only: [GB1525A] },
  { find: 'network parameters including but not limited to', replace: 'network parameters include but are not limited to', kind: 'grammar', only: [GB1525A] },
  { find: 'but need Human intervention', replace: 'but needs Human intervention', kind: 'grammar', only: [GB1524E] },
  { find: 'both syntax and semantic.', replace: 'both syntax and semantics.', kind: 'grammar', only: [GB1524E] },
  { find: 'The syntax and semantic of', replace: 'The syntax and semantics of', kind: 'grammar', only: [GB1524E] },
  { find: 'based online simulation', replace: 'based on online simulation', kind: 'grammar', only: [GB1524E] },
  { find: 'in whole network', replace: 'in the whole network', kind: 'grammar', only: [GB1524E] },
  { find: 'along with it is availability', replace: 'along with its availability', kind: 'grammar', only: [GB1525A] },
  { find: 'which aligned with integrity', replace: 'which are aligned with integrity', kind: 'grammar', only: [GB1525A] },
  { find: 'Human manually evaluate the effect', replace: 'Human manually evaluates the effect', kind: 'grammar', only: [GB1525A] },
  { find: 'How does the system collects data?', replace: 'How does the system collect data?', kind: 'grammar', only: [GB1525A] },
  { find: 'How does the system identifies RAN', replace: 'How does the system identify RAN', kind: 'grammar', only: [GB1525A] },
  { find: 'issues and diagnoses root cause based on', replace: 'issues and diagnose root cause based on', kind: 'grammar', only: [GB1525A] },
  { find: 'identified or and predicted', replace: 'identified or predicted', kind: 'grammar', only: [GB1525A] },
  { find: '(considering of the coordination', replace: '(considering the coordination', kind: 'grammar', only: [GB1525A] },
  { find: 'actions and support the capability', replace: 'actions and supports the capability', kind: 'grammar', only: [GB1525A] },
  { find: 'CSP provide All closed-loop', replace: 'CSP provides all closed-loop', kind: 'grammar', only: [GB1525A] },
  { find: 'CSP provide the optimization', replace: 'CSP provides the optimization', kind: 'grammar', only: [GB1525A] },
  { find: 'each of the optimization work order needs', replace: 'each optimization work order needs', kind: 'grammar', only: [GB1525A] },
  { find: 'Total number of optimization work order)', replace: 'Total number of optimization work orders)', kind: 'grammar', only: [GB1525A] },
  { find: 'monitors Service quality and detect anomalies', replace: 'monitors Service quality and detects anomalies', kind: 'grammar', only: [GB1525D] },
  { find: 'only learns of service interrupt when', replace: 'only learns of service interruption when', kind: 'grammar', only: [GB1525D] },
  { find: 'People manually identified risks', replace: 'People manually identify risks', kind: 'grammar', only: [GB1525D] },
  { find: 'where fibers co-routes affect a large number of service.', replace: 'where fibers co-route affect a large number of services.', kind: 'grammar', only: [GB1525D] },
  { find: 'or can continuously learns', replace: 'or can continuously learn', kind: 'grammar', only: [GB1525D] },
  { find: 'rules, and decision-making are manually executed', replace: 'rules, and decision-making is manually executed', kind: 'grammar', only: [GB1525D] },
  { find: 'implements optimizing solution that require', replace: 'implements an optimizing solution that requires', kind: 'grammar', only: [GB1525D] },
  { find: 'when the quality of paths decrease', replace: 'when the quality of paths decreases', kind: 'grammar', only: [GB1525E] },
  { find: '(do not affect the overall score)', replace: '(does not affect the overall score)', kind: 'grammar', only: [GB1525E] },
  { find: 'policy that traverse the congested', replace: 'policy that traverses the congested', kind: 'grammar', only: [GB1525E] },
  { find: 'policy that carrying the VPN', replace: 'policy that carries the VPN', kind: 'grammar', only: [GB1525E] },
  { find: 'supports collect and display', replace: 'supports collecting and displaying', kind: 'grammar', only: [GB1525E] },
  { find: 'System identify KPI degradation', replace: 'System identifies KPI degradation', kind: 'grammar', only: [GB1525E] },
  { find: 'and manually identify KPI degradation', replace: 'and KPI degradation is manually identified', kind: 'grammar', only: [GB1525E] },
  { find: 'intelligently locate the root cause', replace: 'intelligently locates the root cause', kind: 'grammar', only: [GB1525E] },
  { find: 'Does the system automatically generates', replace: 'Does the system automatically generate', kind: 'grammar', only: [GB1525E] },
  { find: 'and make decision.', replace: 'and make a decision.', kind: 'grammar', only: [GB1525E] },
  { find: 'in a period more than 1 month', replace: 'in a period of more than 1 month', kind: 'grammar', only: [GB1525E] },
  { find: 'records that are failed caused by', replace: 'records that failed because of', kind: 'grammar', only: [GB1525E] },
  { find: 'degradation scenario that are caused', replace: 'degradation scenarios that are caused', kind: 'grammar', only: [GB1525E] },
  { find: 'frequencies band/carrier', replace: 'frequency bands/carriers', kind: 'grammar', only: [GB1526A] },
  { find: 'Human manually select candidate energy-saving objects (e.g. NE/CELL) and confirm', replace: 'Human manually selects candidate energy-saving objects (e.g. NE/CELL) and confirms', kind: 'grammar', only: [GB1526A] },
  { find: '(B) The intelligently (mostly', replace: '(B) The System intelligently (mostly', kind: 'grammar', only: [GB1526A] },
  { find: 'issues and analyze their root cause', replace: 'issues and analyzes their root cause', kind: 'grammar', only: [GB1526A] },
  { find: 'actions, and analyze their root cause', replace: 'actions, and analyzes their root cause', kind: 'grammar', only: [GB1526A] },
  { find: 'rules. the root cause', replace: 'rules. The root cause', kind: 'grammar', only: [GB1526A] },
  { find: "in hour's level time period", replace: 'in an hour-level time period', kind: 'grammar', only: [GB1526A] },
  { find: 'Collection the data about', replace: 'Collection of the data about', kind: 'grammar', only: [GB1528A] },
  { find: 'deviations as result of', replace: 'deviations as a result of', kind: 'grammar', only: [GB1528A] },
  { find: 'The System Identifies Routine Maintenance risks and analyse their impact', replace: 'The System identifies Routine Maintenance risks and analyses their impact', kind: 'grammar', only: [GB1528A] },
  { find: 'evaluate the recommends solutions', replace: 'evaluate the recommended solutions', kind: 'grammar', only: [GB1528A] },
  { find: 'assess the network in secure way', replace: 'assess the network in a secure way', kind: 'grammar', only: [GB1529] },
  { find: 'monitoring system detect this activity', replace: 'monitoring system detects this activity', kind: 'grammar', only: [GB1529] },
  { find: 'defined baselines and standard.', replace: 'defined baselines and standards.', kind: 'grammar', only: [GB1529] },
  { find: 'Humans is assisted', replace: 'Humans are assisted', kind: 'grammar', only: [GB1529] },
  { find: 'Threat Hunting, is about', replace: 'Threat Hunting is about', kind: 'grammar', only: [GB1529] },
  { find: 'does not require specifically probe measurements', replace: 'does not require specific probe measurements', kind: 'grammar', only: [GB1503A] },
  { find: 'VoLTE/VoNR call drop rate) and detect performance degradation, outage or anomalies without', replace: 'VoLTE/VoNR call drop rate) and detects performance degradation, outage or anomalies without', kind: 'grammar', only: [GB1503A] },
  { find: 'VoLTE/VoNR call drop rate) and detect performance degradation, outage or anomalies based', replace: 'VoLTE/VoNR call drop rate) and detects performance degradation, outage or anomalies based', kind: 'grammar', only: [GB1503A] },
  { find: 'can automatically resolved?', replace: 'can automatically resolve?', kind: 'grammar', only: [GB1503B] },
  { find: 'The Sum of issue resolved', replace: 'The Sum of issues resolved', kind: 'grammar', only: [GB1503B] },
  { find: 'this issue partly fulfill', replace: 'this issue partly fulfills', kind: 'grammar', only: [GB1503B] },
  { find: 'at minute-level and detect anomalies', replace: 'at minute-level and detects anomalies', kind: 'grammar', only: [GB1503H] },
  { find: 'predicts SLA violation and give suggestion', replace: 'predicts SLA violation and gives suggestions', kind: 'grammar', only: [GB1503H] },
  { find: 'How does the System evaluates solution', replace: 'How does the System evaluate solution', kind: 'grammar', only: [GB1503H] },
  { find: 'The System process complaint intents', replace: 'The System processes complaint intents', kind: 'grammar', only: [GB1504A] },
  { find: 'Complaint intents processed based on', replace: 'Complaint intents are processed based on', kind: 'grammar', only: [GB1504A] },
  { find: 'The system determine the impact', replace: 'The system determines the impact', kind: 'grammar', only: [GB1504A] },
  { find: 'then conduct customer follow-ups', replace: 'then conducts customer follow-ups', kind: 'grammar', only: [GB1504A] },
  { find: 'recommend an optimum solution', replace: 'recommends an optimum solution', kind: 'grammar', only: [GB1505A] },
  { find: 'The system support on-site instruction', replace: 'The system supports on-site instruction', kind: 'grammar', only: [GB1505A] },
  { find: 'Each of the trouble ticket needs', replace: 'Each trouble ticket needs', kind: 'grammar', only: [GB1505A] },
  { find: 'with fault detect and recovery time', replace: 'with fault detection and recovery time', kind: 'grammar', only: [GB1505A] },
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
