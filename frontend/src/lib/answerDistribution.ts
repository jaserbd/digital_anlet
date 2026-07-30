import type { AnswerDrilldownEntryDto, AnswerOption, DrilldownRespondentDto, QuestionDto, SubScenarioDto } from '@anlet/shared';
import type { OptionCountsChartRow } from '../components/charts/OptionCountsChart';

export const ANSWER_OPTIONS: AnswerOption[] = ['A', 'B', 'C', 'D'];

export interface AnswerDistributionIndex {
  countsByKey: Map<string, Record<AnswerOption, number>>;
  respondentsByKey: Map<string, DrilldownRespondentDto[]>;
}

// Scopes `entries` to one NatCo (or leaves them unscoped) and indexes them by
// (question, subScenario) counts and (question, subScenario, option) respondent lists.
// Shared by AnswerDistributionDrilldown.tsx (on-screen) and pdfSections.ts (report export) so
// both derive identical numbers from the same drilldown entries.
export function indexAnswerDistribution(
  entries: AnswerDrilldownEntryDto[],
  opCoScopeId?: string | null,
): AnswerDistributionIndex {
  const countsByKey = new Map<string, Record<AnswerOption, number>>();
  const respondentsByKey = new Map<string, DrilldownRespondentDto[]>();
  for (const e of entries) {
    const respondents = opCoScopeId ? e.respondents.filter((r) => r.opCoId === opCoScopeId) : e.respondents;
    respondentsByKey.set(`${e.questionId}:${e.subScenarioId}:${e.option}`, respondents);
    const countKey = `${e.questionId}:${e.subScenarioId}`;
    const counts = countsByKey.get(countKey) ?? { A: 0, B: 0, C: 0, D: 0 };
    counts[e.option] = respondents.length;
    countsByKey.set(countKey, counts);
  }
  return { countsByKey, respondentsByKey };
}

// Builds one OptionCountsChart data row per sub-scenario for a single question — identical
// shape/values to the on-screen counts table cells.
export function buildOptionCountsChartData(
  question: QuestionDto,
  subScenarios: SubScenarioDto[],
  countsByKey: Map<string, Record<AnswerOption, number>>,
  availableOptionsOrdered: AnswerOption[],
): OptionCountsChartRow[] {
  return subScenarios.map((s) => {
    const counts = countsByKey.get(`${question.id}:${s.id}`);
    const row: OptionCountsChartRow = { subScenario: s.name };
    for (const option of availableOptionsOrdered) {
      row[option] = counts?.[option] ?? 0;
    }
    return row;
  });
}
