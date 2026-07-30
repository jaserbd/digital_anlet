// FORTH_REVIEW.md items 5/6: Core Network Fault Management and Core Network Stability are
// two independent questionnaires (different question sets, answered separately — see
// CLAUDE.md "Core Domain"), but CORE_FM.xlsx's Guideline treats them as two halves of one
// HVS with a 50/50 combined score. Nothing in the schema linked them until now beyond two
// hardcoded string constants private to responses.service.ts's getCoreDomainSummary — this
// module generalizes that into a small, reusable config instead of a schema
// column/migration, since only one such pairing exists today and it's purely a display/
// aggregation grouping, never a scoring input.
export interface HvsGroupDefinition {
  groupCode: string;
  groupName: string;
  networkType: string;
  questionnaireCodes: string[];
}

export const CORE_FAULT_MANAGEMENT_CODE = 'CORE_FM_GB1059B';
export const CORE_STABILITY_CODE = 'CORE_STABILITY_GB1059B';

export const HVS_GROUPS: HvsGroupDefinition[] = [
  {
    groupCode: 'CORE_FM_STABILITY',
    groupName: 'Core Network Fault Management & Stability Assessment',
    networkType: 'Core',
    questionnaireCodes: [CORE_FAULT_MANAGEMENT_CODE, CORE_STABILITY_CODE],
  },
];

export function findHvsGroupForQuestionnaire(code: string): HvsGroupDefinition | undefined {
  return HVS_GROUPS.find((g) => g.questionnaireCodes.includes(code));
}

export function findHvsGroupByCode(groupCode: string): HvsGroupDefinition | undefined {
  return HVS_GROUPS.find((g) => g.groupCode === groupCode);
}
