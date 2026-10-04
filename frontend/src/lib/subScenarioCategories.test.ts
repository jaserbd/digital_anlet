import { describe, expect, it } from 'vitest';
import type { SubScenarioDto } from '@anlet/shared';
import {
  categoryRowSpans,
  formatSubScenarioLabel,
  groupSubScenariosByCategory,
  hasSubScenarioCategories,
} from './subScenarioCategories';

function subScenario(id: string, category: string | null): SubScenarioDto {
  return {
    id,
    code: id.toUpperCase(),
    name: `Name ${id}`,
    description: '',
    category,
    faultDistributionWeight: 0.1,
    sortOrder: 0,
  };
}

// IP FM's layout: 1 Equipment, 5 Communication, 2 Quality of service.
const ip = [
  subScenario('hw', 'Equipment'),
  subScenario('offline', 'Communication'),
  subScenario('optical', 'Communication'),
  subScenario('port', 'Communication'),
  subScenario('ber', 'Communication'),
  subScenario('protocol', 'Communication'),
  subScenario('vpn-deg', 'Quality of service'),
  subScenario('vpn-int', 'Quality of service'),
];
const ran = [subScenario('eq', null), subScenario('comms', null)];

describe('subScenarioCategories', () => {
  it('detects whether a questionnaire has categories at all', () => {
    expect(hasSubScenarioCategories(ip)).toBe(true);
    expect(hasSubScenarioCategories(ran)).toBe(false);
  });

  it('groups contiguous sub-scenarios by category, preserving order', () => {
    expect(groupSubScenariosByCategory(ip).map((g) => [g.category, g.subScenarios.length])).toEqual(
      [
        ['Equipment', 1],
        ['Communication', 5],
        ['Quality of service', 2],
      ],
    );
    // Uncategorized questionnaires collapse into a single null group.
    expect(
      groupSubScenariosByCategory(ran).map((g) => [g.category, g.subScenarios.length]),
    ).toEqual([[null, 2]]);
  });

  it("gives each group's first sub-scenario the merged Category cell rowSpan", () => {
    expect([...categoryRowSpans(ip)]).toEqual([
      ['hw', 1],
      ['offline', 5],
      ['vpn-deg', 2],
    ]);
  });

  it('prefixes the category in flat labels only when there is one', () => {
    expect(formatSubScenarioLabel(ip[3]!)).toBe('Communication · Name port');
    expect(formatSubScenarioLabel(ran[0]!)).toBe('Name eq');
  });
});
