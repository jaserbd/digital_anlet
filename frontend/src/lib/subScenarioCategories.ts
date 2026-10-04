import type { SubScenarioDto } from '@anlet/shared';

// Sub-scenario categories (e.g. IP FM's Equipment / Communication / Quality of service) come
// straight from each xlsx's merged header row above its sub-scenario columns. Questionnaires
// without them (RAN, Core, Fixed Access) have category null everywhere, and every helper here
// then degrades to the original flat, uncategorized rendering.

export interface SubScenarioCategoryGroup {
  category: string | null;
  subScenarios: SubScenarioDto[];
}

export function hasSubScenarioCategories(subScenarios: SubScenarioDto[]): boolean {
  return subScenarios.some((s) => s.category != null);
}

/** Contiguous runs of sub-scenarios sharing a category, in sortOrder (the xlsx's merged
 * headers always span adjacent columns, so a category never appears in two runs). */
export function groupSubScenariosByCategory(
  subScenarios: SubScenarioDto[],
): SubScenarioCategoryGroup[] {
  const groups: SubScenarioCategoryGroup[] = [];
  for (const s of subScenarios) {
    const last = groups[groups.length - 1];
    if (last && last.category === s.category) {
      last.subScenarios.push(s);
    } else {
      groups.push({ category: s.category, subScenarios: [s] });
    }
  }
  return groups;
}

/** Flat label for places that can't render a grouped header (sortable-table headers,
 * Excel/PDF columns, chart axes): "Communication · Port Failure", or just the name. */
export function formatSubScenarioLabel(s: SubScenarioDto): string {
  return s.category ? `${s.category} · ${s.name}` : s.name;
}

/** For a table with one row per sub-scenario and a merged Category column: the rowSpan of
 * each group's first sub-scenario (keyed by id). Sub-scenarios absent from the map are
 * covered by the cell above and render no Category cell. */
export function categoryRowSpans(subScenarios: SubScenarioDto[]): Map<string, number> {
  return new Map(
    groupSubScenariosByCategory(subScenarios).map((g) => [
      g.subScenarios[0]!.id,
      g.subScenarios.length,
    ]),
  );
}
