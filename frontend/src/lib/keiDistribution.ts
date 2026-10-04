import type {
  AnswerOption,
  CrossOrgKeiCommentEntryDto,
  EffectivenessIndicatorDto,
  KeiDrilldownEntryDto,
} from '@anlet/shared';
import type { CommentCollectionRow } from '../components/CommentCollectionTable';
import type { OptionCountsChartRow } from '../components/charts/OptionCountsChart';
import type { XlsxSheet } from './exportXlsx';
import type { PdfSection } from './exportPdf';
import { formatKeiAnswer, keiOptionScore } from './kei';

// Aggregation of submitted Key Effectiveness Indicator answers for the Executive / Admin
// views (NEW_HVS_PLAN.md Phase B), derived client-side from the drill-down's flat
// keiResponses list — the KEI analogue of answerDistribution.ts. "Skipped" counts
// respondents who left a KEI unanswered and explained why in its comment.

export type KeiBucket = AnswerOption | 'skipped';

export interface KeiDistributionIndex {
  countsByIndicator: Map<string, Record<KeiBucket, number>>;
  respondentsByKey: Map<string, KeiDrilldownEntryDto[]>; // `${indicatorId}:${bucket}`
}

function emptyCounts(): Record<KeiBucket, number> {
  return { A: 0, B: 0, C: 0, D: 0, skipped: 0 };
}

export function indexKeiResponses(
  responses: KeiDrilldownEntryDto[],
  opCoScopeId?: string | null,
): KeiDistributionIndex {
  const countsByIndicator = new Map<string, Record<KeiBucket, number>>();
  const respondentsByKey = new Map<string, KeiDrilldownEntryDto[]>();
  for (const r of responses) {
    // Same convention as indexAnswerDistribution: a falsy scope means unscoped.
    if (opCoScopeId && r.respondent.opCoId !== opCoScopeId) continue;
    const bucket: KeiBucket = r.selectedOption ?? 'skipped';
    const counts = countsByIndicator.get(r.indicatorId) ?? emptyCounts();
    counts[bucket] += 1;
    countsByIndicator.set(r.indicatorId, counts);
    const key = `${r.indicatorId}:${bucket}`;
    respondentsByKey.set(key, [...(respondentsByKey.get(key) ?? []), r]);
  }
  return { countsByIndicator, respondentsByKey };
}

/** The options any of these indicators offers, in A-D order (KEIs use A-C today). */
export function keiOptionsOffered(indicators: EffectivenessIndicatorDto[]): AnswerOption[] {
  const offered = new Set(indicators.flatMap((k) => k.options.map((o) => o.option)));
  return (['A', 'B', 'C', 'D'] as const).filter((o) => offered.has(o));
}

/** One OptionCountsChart row per indicator (the chart's category axis). */
export function buildKeiChartData(
  indicators: EffectivenessIndicatorDto[],
  index: KeiDistributionIndex,
): OptionCountsChartRow[] {
  const options = keiOptionsOffered(indicators);
  return indicators.map((k) => {
    const counts = index.countsByIndicator.get(k.id);
    const row: OptionCountsChartRow = { subScenario: k.name };
    for (const option of options) row[option] = counts?.[option] ?? 0;
    return row;
  });
}

/** Flat per-respondent sheet: every submitted KEI answer, value and comment. */
export function buildKeiResponsesSheet(
  indicators: EffectivenessIndicatorDto[],
  responses: KeiDrilldownEntryDto[],
): XlsxSheet {
  const indicatorById = new Map(indicators.map((k) => [k.id, k]));
  return {
    name: 'Effectiveness indicators',
    columns: [
      { header: 'Email', key: 'email' },
      { header: 'NatCo', key: 'opCoName' },
      { header: 'Country', key: 'country' },
      { header: 'Designation', key: 'designation' },
      { header: 'Indicator', key: 'indicator' },
      { header: 'Answer', key: 'answer' },
      { header: 'Score', key: 'score' },
      { header: 'Measured value', key: 'value' },
      { header: 'Comment', key: 'comment' },
    ],
    rows: responses.flatMap((r) => {
      const indicator = indicatorById.get(r.indicatorId);
      if (!indicator) return [];
      return [
        {
          email: r.respondent.email,
          opCoName: r.respondent.opCoName ?? '',
          country: r.respondent.country ?? '',
          designation: r.respondent.designation ?? '',
          indicator: indicator.name,
          answer: r.selectedOption ? formatKeiAnswer(indicator, r.selectedOption) : 'Skipped',
          score: keiOptionScore(indicator, r.selectedOption) ?? '',
          value: r.indicatorValue ?? '',
          comment: r.comment ?? '',
        },
      ];
    }),
  };
}

/** Counts table plus the per-respondent detail, for the organization PDF report. */
export function buildKeiDistributionPdfSections(
  indicators: EffectivenessIndicatorDto[],
  responses: KeiDrilldownEntryDto[],
): PdfSection[] {
  if (indicators.length === 0) return [];
  const index = indexKeiResponses(responses);
  const options = keiOptionsOffered(indicators);
  const sheet = buildKeiResponsesSheet(indicators, responses);
  return [
    {
      kind: 'table',
      heading: 'Key Effectiveness Indicators — answer distribution',
      head: [['Indicator', 'Weight', ...options.map((o) => `Option ${o}`), 'Skipped']],
      body: indicators.map((k) => {
        const counts = index.countsByIndicator.get(k.id) ?? emptyCounts();
        return [
          k.name,
          `${(k.weight * 100).toFixed(0)}%`,
          ...options.map((o) => String(counts[o])),
          String(counts.skipped),
        ];
      }),
    },
    ...(sheet.rows.length > 0
      ? [
          {
            kind: 'table' as const,
            heading: 'Key Effectiveness Indicators — respondents',
            head: [['Email', 'NatCo', 'Indicator', 'Answer', 'Measured value', 'Comment']],
            body: sheet.rows.map((r) => [
              String(r.email),
              String(r.opCoName || '—'),
              String(r.indicator),
              String(r.answer),
              String(r.value || '—'),
              String(r.comment || '—'),
            ]),
          },
        ]
      : []),
  ];
}

// Key Effectiveness Indicator comments (NEW_HVS_PLAN.md Phase B) join the same flat table:
// KEIs have no Cognitive Activity or sub-scenario, so those columns carry a fixed
// "Effectiveness Indicator" label and the indicator's name respectively.
const KEI_COMMENT_ACTIVITY_LABEL = 'Effectiveness Indicator';

function flattenKeiCommentRows<T extends KeiDrilldownEntryDto>(
  keiResponses: T[],
  indicators: EffectivenessIndicatorDto[],
  extra: (entry: T) => Partial<CommentCollectionRow>,
): CommentCollectionRow[] {
  const nameById = new Map(indicators.map((k) => [k.id, k.name]));
  return keiResponses.flatMap((k) =>
    k.comment?.trim()
      ? [
          {
            key: `kei:${k.indicatorId}:${k.respondent.userId}`,
            email: k.respondent.email,
            opCoName: k.respondent.opCoName,
            country: k.respondent.country,
            designation: k.respondent.designation,
            cognitiveActivity: KEI_COMMENT_ACTIVITY_LABEL,
            subScenario: nameById.get(k.indicatorId) ?? '—',
            comment: k.comment,
            ...extra(k),
          },
        ]
      : [],
  );
}

export function buildKeiCommentRows(
  keiResponses: KeiDrilldownEntryDto[],
  indicators: EffectivenessIndicatorDto[],
): CommentCollectionRow[] {
  return flattenKeiCommentRows(keiResponses, indicators, () => ({}));
}

export function buildCrossOrgKeiCommentRows(
  keiComments: CrossOrgKeiCommentEntryDto[],
  indicators: EffectivenessIndicatorDto[],
): CommentCollectionRow[] {
  return flattenKeiCommentRows(keiComments, indicators, (k) => ({ organizationName: k.organizationName }));
}
