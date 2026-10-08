import { describe, expect, it } from 'vitest';
import type { ParsedQuestionnaire } from './parsedQuestionnaire.types';
import { parseRanFmXlsx } from './parseRanFmXlsx';
import { parseCoreFaultManagementXlsx, parseCoreStabilityXlsx } from './parseCoreFmXlsx';
import { parseIpFmXlsx } from './parseIpFmXlsx';
import { parseTransportMicrowaveXlsx, parseTransportOtnXlsx } from './parseTransportXlsx';
import { parseFixedAccessXlsx } from './parseFixedAccessXlsx';
import { TEXT_CORRECTIONS, applyTextCorrections, normalizeSpacing, type TextCorrection } from './textCorrections';

const parsedAll: ParsedQuestionnaire[] = [
  parseRanFmXlsx(),
  parseCoreFaultManagementXlsx(),
  parseCoreStabilityXlsx(),
  parseIpFmXlsx(),
  parseTransportMicrowaveXlsx(),
  parseTransportOtnXlsx(),
  parseFixedAccessXlsx(),
];

function allText(q: ParsedQuestionnaire): string {
  return JSON.stringify([
    q.name,
    q.guidelineText,
    q.keiNote,
    q.subScenarios.map((s) => s.description),
    q.questions.map((x) => [x.serviceCapability, x.questionText, x.optionText, x.answeringGuideline]),
    q.effectivenessIndicators.map((k) => [k.name, k.description, k.optionText]),
  ]);
}

describe('TEXT_CORRECTIONS', () => {
  const matches = new Map<TextCorrection, number>();
  const corrected = parsedAll.map((q) => applyTextCorrections(q, matches));

  // A fix that no longer finds its text means the source changed — remove or update it.
  it.each(TEXT_CORRECTIONS.map((c) => [c.find, c] as const))('still matches the source: %j', (_find, c) => {
    expect(matches.get(c) ?? 0).toBeGreaterThan(0);
  });

  it('leaves no known misspelling behind', () => {
    const text = corrected.map(allText).join('\n');
    for (const typo of ['scenairo', 'identifty', 'intructions', 'petential', 'milisecond', 'serive', 'unaccessable', 'fileting', 'rogramable', 'nature language', 'Nature Language']) {
      expect(text).not.toContain(typo);
    }
  });

  it('changes only text — never codes, weights, criteria or structure', () => {
    corrected.forEach((after, i) => {
      const before = parsedAll[i]!;
      expect(after.code).toBe(before.code);
      expect(after.subScenarios.map((s) => [s.code, s.name, s.faultDistributionWeight])).toEqual(
        before.subScenarios.map((s) => [s.code, s.name, s.faultDistributionWeight]),
      );
      expect(after.questions.map((q) => [q.sortOrder, q.weight, q.optionCriteria, Object.keys(q.optionText)])).toEqual(
        before.questions.map((q) => [q.sortOrder, q.weight, q.optionCriteria, Object.keys(q.optionText)]),
      );
      expect(after.effectivenessIndicators.map((k) => [k.sortOrder, k.weight, k.optionCriteria])).toEqual(
        before.effectivenessIndicators.map((k) => [k.sortOrder, k.weight, k.optionCriteria]),
      );
    });
  });
});

describe('normalizeSpacing', () => {
  it('collapses inner spaces, removes space before punctuation and full-width punctuation', () => {
    expect(normalizeSpacing('a  b , c ?')).toBe('a b, c?');
    expect(normalizeSpacing('manually\u00a0identify')).toBe('manually identify');
    expect(normalizeSpacing('Note : x')).toBe('Note: x');
    expect(normalizeSpacing('Abnormal：optical')).toBe('Abnormal: optical');
    expect(normalizeSpacing('Equipment\n（should')).toBe('Equipment\n(should');
    expect(normalizeSpacing('line  \nnext')).toBe('line\nnext');
  });

  it('keeps leading indentation and line breaks', () => {
    expect(normalizeSpacing('  indented\r\n- item')).toBe('  indented\r\n- item');
  });
});
