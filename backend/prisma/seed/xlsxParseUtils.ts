import type { AnswerOption } from '@anlet/shared';

/** Builds a { A?, B?, C?, D? } map from 4 positional values, dropping any that are absent
 * (not every question offers/scores all 4 options). */
export function optionMap<T>(values: [T, T, T, T]): Partial<Record<AnswerOption, T>> {
  const [a, b, c, d] = values;
  const result: Partial<Record<AnswerOption, T>> = {};
  if (a != null) result.A = a;
  if (b != null) result.B = b;
  if (c != null) result.C = c;
  if (d != null) result.D = d;
  return result;
}
