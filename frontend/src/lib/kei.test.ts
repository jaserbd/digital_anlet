import { describe, expect, it } from 'vitest';
import type { DrilldownRespondentIdentityDto, EffectivenessIndicatorDto, KeiDrilldownEntryDto } from '@anlet/shared';
import { formatKeiAnswer, isKeiCovered, keiResultRows } from './kei';
import { buildKeiCommentRows, buildKeiResponsesSheet, indexKeiResponses } from './keiDistribution';

const options = [
  { option: 'A' as const, text: '<=8 hour', criteria: 4 },
  { option: 'B' as const, text: '<=10hour >8 hour', criteria: 3 },
  { option: 'C' as const, text: '>10hour', criteria: 2 },
];
const mttr: EffectivenessIndicatorDto = { id: 'mttr', sortOrder: 0, name: 'MTTR', description: '', weight: 0.6, options };
const automation: EffectivenessIndicatorDto = {
  id: 'auto',
  sortOrder: 1,
  name: 'Automation rate',
  description: '',
  weight: 0.4,
  options,
};

function respondent(userId: string, opCoId: string | null): DrilldownRespondentIdentityDto {
  return { userId, email: `${userId}@x.test`, opCoId, opCoName: opCoId, country: null, workingDomain: null, designation: null };
}

function entry(
  indicatorId: string,
  selectedOption: 'A' | 'B' | 'C' | null,
  who: DrilldownRespondentIdentityDto,
  comment: string | null = null,
): KeiDrilldownEntryDto {
  return { indicatorId, selectedOption, indicatorValue: null, comment, respondent: who };
}

describe('isKeiCovered', () => {
  it('needs an answer or a non-blank comment — a measured value alone is not enough', () => {
    expect(isKeiCovered(undefined)).toBe(false);
    expect(isKeiCovered({ indicatorId: 'k', selectedOption: 'B', indicatorValue: null, comment: null })).toBe(true);
    expect(isKeiCovered({ indicatorId: 'k', selectedOption: null, indicatorValue: null, comment: 'unknown' })).toBe(true);
    expect(isKeiCovered({ indicatorId: 'k', selectedOption: null, indicatorValue: '85%', comment: '  ' })).toBe(false);
  });
});

describe('KEI results rows', () => {
  it('shows the chosen range and its score, and "—" for a skipped KEI', () => {
    const rows = keiResultRows(
      [mttr, automation],
      [
        { indicatorId: 'mttr', selectedOption: 'B', indicatorValue: '9h', comment: null },
        { indicatorId: 'auto', selectedOption: null, indicatorValue: null, comment: 'Not tracked' },
      ],
    );
    expect(rows.map((r) => [r.answer, r.score, r.value, r.comment])).toEqual([
      ['B — <=10hour >8 hour (3)', 3, '9h', null],
      ['—', null, null, 'Not tracked'],
    ]);
    expect(formatKeiAnswer(mttr, null)).toBe('—');
  });
});

describe('KEI distribution', () => {
  const de1 = respondent('u1', 'de');
  const de2 = respondent('u2', 'de');
  const nl1 = respondent('u3', 'nl');
  const responses = [
    entry('mttr', 'A', de1),
    entry('mttr', 'A', nl1),
    entry('mttr', null, de2, 'No ticket data'),
    entry('auto', 'C', de1, 'Pilot only'),
  ];

  it('counts each option plus comment-only skips, per indicator', () => {
    const { countsByIndicator, respondentsByKey } = indexKeiResponses(responses);
    expect(countsByIndicator.get('mttr')).toEqual({ A: 2, B: 0, C: 0, D: 0, skipped: 1 });
    expect(respondentsByKey.get('mttr:skipped')?.map((r) => r.respondent.userId)).toEqual(['u2']);
  });

  it('scopes to one NatCo, or leaves everything in for a falsy scope', () => {
    expect(indexKeiResponses(responses, 'nl').countsByIndicator.get('mttr')).toEqual({ A: 1, B: 0, C: 0, D: 0, skipped: 0 });
    expect(indexKeiResponses(responses, null).countsByIndicator.get('mttr')?.A).toBe(2);
  });

  it('turns KEI comments into Comment Collection rows', () => {
    const rows = buildKeiCommentRows(responses, [mttr, automation]);
    expect(rows.map((r) => [r.email, r.cognitiveActivity, r.subScenario, r.comment])).toEqual([
      ['u2@x.test', 'Effectiveness Indicator', 'MTTR', 'No ticket data'],
      ['u1@x.test', 'Effectiveness Indicator', 'Automation rate', 'Pilot only'],
    ]);
  });

  it('exports one row per respondent answer, marking skips', () => {
    const sheet = buildKeiResponsesSheet([mttr, automation], responses);
    expect(sheet.rows.map((r) => [r.email, r.indicator, r.answer, r.score])).toEqual([
      ['u1@x.test', 'MTTR', 'A — <=8 hour (4)', 4],
      ['u3@x.test', 'MTTR', 'A — <=8 hour (4)', 4],
      ['u2@x.test', 'MTTR', 'Skipped', ''],
      ['u1@x.test', 'Automation rate', 'C — >10hour (2)', 2],
    ]);
  });
});
