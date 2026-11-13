import type { QuestionnaireSummaryDto } from '@anlet/shared';

// Short badges for the project dashboard (ADMIN_DASHBOARD_PLAN.md): Domain + HVS initials, e.g.
// RAN-FM, Core-ST, TR-MW-FM — "FM" alone would be ambiguous (five domains have Fault Management).
// Questionnaires still in review at TM Forum get " (R)", like their names.

const DOMAIN_ABBREVIATIONS: Record<string, string> = {
  RAN: 'RAN',
  Core: 'Core',
  IP: 'IP',
  Transport: 'TR',
  'Fixed Access': 'FA',
  'Home Broadband': 'HBB',
  'Individual Services': 'IS',
  'IP Private Line': 'IPPL',
  'Private Line': 'PL',
  Security: 'SEC',
};

const HVS_ABBREVIATIONS: Record<string, string> = {
  'Fault Management': 'FM',
  Stability: 'ST',
  'Change Management': 'CM',
  Deployment: 'DEP',
  Planning: 'PLAN',
  'Quality Optimization': 'QO',
  'Energy Efficiency Optimization': 'EEO',
  'Routine Maintenance': 'RM',
  'Proactive Security': 'PS',
  'Service Assurance': 'SA',
  'Complaint Handling': 'CH',
  'Service Delivery': 'SD',
  'Service Fault Management': 'SFM',
};

/** Initials of each word ("Network Slicing" → "NS"), for domains/HVSs added later. */
function wordInitials(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function questionnaireInitials(q: Pick<QuestionnaireSummaryDto, 'name' | 'networkType' | 'hvsCategory' | 'inReview'>): string {
  let domain = DOMAIN_ABBREVIATIONS[q.networkType] ?? wordInitials(q.networkType);
  // Transport has two technologies with their own questionnaires.
  if (q.networkType === 'Transport') {
    if (/microwave/i.test(q.name)) domain += '-MW';
    else if (/\bOTN\b/.test(q.name)) domain += '-OTN';
  }
  const hvs = HVS_ABBREVIATIONS[q.hvsCategory] ?? wordInitials(q.hvsCategory);
  return `${domain}-${hvs}${q.inReview ? ' (R)' : ''}`;
}
