import { describe, expect, it } from 'vitest';
import type { AnswerDrilldownEntryDto, QuestionDto, SubScenarioDto } from '@anlet/shared';
import { buildAnswerMatrix } from './answerMatrix';

const subScenario: SubScenarioDto = {
  id: 'sub-1',
  code: 'EQUIPMENT',
  name: 'Equipment',
  description: '',
  category: null,
  faultDistributionWeight: 1,
  sortOrder: 0,
};

const question: QuestionDto = {
  id: 'q1',
  sortOrder: 0,
  cognitiveActivity: 'Intent',
  serviceCapability: 'Intent-driven',
  questionText: 'Question?',
  weight: 1,
  includeInE2ECheck: true,
  options: [],
  answeringGuideline: null,
};

const entries: AnswerDrilldownEntryDto[] = [
  {
    questionId: 'q1',
    subScenarioId: 'sub-1',
    option: 'A',
    respondents: [
      {
        userId: 'u1',
        email: 'user@example.com',
        opCoId: null,
        opCoName: null,
        country: null,
        workingDomain: null,
        designation: null,
        comment: 'A comment that used to clutter this matrix',
      },
    ],
  },
];

describe('buildAnswerMatrix', () => {
  it('produces a pure identity + A/B/C/D option matrix with no Comment column (ADMIN_3.md item 3)', () => {
    const sheets = buildAnswerMatrix([question], [subScenario], entries);
    expect(sheets).toHaveLength(1);
    const [sheet] = sheets;

    expect(sheet!.columns.some((c) => c.header.includes('Comment'))).toBe(false);
    expect(sheet!.columns.map((c) => c.header)).toContain('Intent (Intent-driven) — Equipment');
    expect(sheet!.rows).toEqual([
      {
        email: 'user@example.com',
        opCoName: '',
        country: '',
        workingDomain: '',
        designation: '',
        'answer:q1:sub-1': 'A',
      },
    ]);
  });
});

// ANONYMOUS_EXECUTIVE_PLAN.md: an Executive's export shows a "Participant" column (the server
// already replaced the email with a pseudonym) and no Designation column.
describe('buildAnswerMatrix (anonymized)', () => {
  const anonEntries: AnswerDrilldownEntryDto[] = [
    {
      questionId: 'q1',
      subScenarioId: 'sub-1',
      option: 'A',
      respondents: ['Participant 10', 'Participant 2'].map((label) => ({
        userId: label,
        email: label,
        opCoId: null,
        opCoName: 'NatCo DE',
        country: 'Germany',
        workingDomain: 'IP',
        designation: null,
        comment: null,
      })),
    },
  ];

  it('labels the identity column "Participant", drops Designation, and orders labels numerically', () => {
    const [sheet] = buildAnswerMatrix([question], [subScenario], anonEntries, true);
    const headers = sheet!.columns.map((c) => c.header);
    expect(headers[0]).toBe('Participant');
    expect(headers).not.toContain('Email');
    expect(headers).not.toContain('Designation');
    expect(sheet!.rows.map((r) => r.email)).toEqual(['Participant 2', 'Participant 10']);
  });
});
