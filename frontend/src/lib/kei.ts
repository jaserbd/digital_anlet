import type { AnswerOption, EffectivenessIndicatorDto, KeiAnswerDto } from '@anlet/shared';
import type { PdfSection } from './exportPdf';

// Key Effectiveness Indicators (NEW_HVS_PLAN.md Phase B) — answered once per response on an
// A-C range scale, scored separately from the IAADE questions (ScoreResultDto.keiScore).

export function emptyKeiAnswer(indicatorId: string): KeiAnswerDto {
  return { indicatorId, selectedOption: null, indicatorValue: null, comment: null };
}

/** Mirrors responses.service.ts's submit rule: a KEI is covered by an answer, or by a
 * non-empty comment explaining why it can't be answered. A measured value alone isn't enough. */
export function isKeiCovered(answer: KeiAnswerDto | undefined): boolean {
  return !!answer?.selectedOption || !!answer?.comment?.trim();
}

export function keiOptionScore(indicator: EffectivenessIndicatorDto, option: AnswerOption | null): number | null {
  if (!option) return null;
  return indicator.options.find((o) => o.option === option)?.criteria ?? null;
}

/** "A — >= 90% (4)", or "—" when unanswered. */
export function formatKeiAnswer(indicator: EffectivenessIndicatorDto, option: AnswerOption | null): string {
  const selected = option ? indicator.options.find((o) => o.option === option) : undefined;
  return selected ? `${selected.option} — ${selected.text} (${selected.criteria})` : '—';
}

/** One display row per KEI for a respondent's own results (screen table and PDF). */
export function keiResultRows(indicators: EffectivenessIndicatorDto[], answers: KeiAnswerDto[]) {
  const answerById = new Map(answers.map((a) => [a.indicatorId, a]));
  return indicators.map((indicator) => {
    const answer = answerById.get(indicator.id);
    return {
      indicator,
      answer: formatKeiAnswer(indicator, answer?.selectedOption ?? null),
      score: keiOptionScore(indicator, answer?.selectedOption ?? null),
      value: answer?.indicatorValue ?? null,
      comment: answer?.comment ?? null,
    };
  });
}

export function buildKeiResultsPdfSection(
  indicators: EffectivenessIndicatorDto[],
  answers: KeiAnswerDto[],
  keiScore: number | null,
): PdfSection {
  return {
    kind: 'table',
    heading: `Key Effectiveness Indicators (Effective Indicator score: ${keiScore != null ? keiScore.toFixed(2) : '—'} / 4)`,
    head: [['Indicator', 'Weight', 'Answer', 'Score', 'Measured value', 'Comment']],
    body: keiResultRows(indicators, answers).map((r) => [
      r.indicator.name,
      `${(r.indicator.weight * 100).toFixed(0)}%`,
      r.answer,
      r.score != null ? r.score.toFixed(2) : '—',
      r.value ?? '—',
      r.comment ?? '—',
    ]),
  };
}
