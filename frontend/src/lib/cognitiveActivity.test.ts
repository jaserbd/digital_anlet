import { describe, expect, it } from 'vitest';
import { computeCognitiveActivityAverages, groupCoverageStatus, questionCoverageStatus } from './cognitiveActivity';
import type { QuestionDto, QuestionScore } from '@anlet/shared';

function question(overrides: Partial<QuestionDto> & { id: string; cognitiveActivity: string }): QuestionDto {
  return {
    sortOrder: 0,
    serviceCapability: 'Capability',
    questionText: 'Question?',
    weight: 0.5,
    includeInE2ECheck: true,
    options: [],
    answeringGuideline: null,
    ...overrides,
  };
}

describe('questionCoverageStatus', () => {
  it('is complete when every sub-scenario is answered', () => {
    expect(questionCoverageStatus(5, 5)).toBe('complete');
  });

  it('is empty when nothing is answered', () => {
    expect(questionCoverageStatus(0, 5)).toBe('empty');
  });

  it('is partial for anything in between', () => {
    expect(questionCoverageStatus(2, 5)).toBe('partial');
  });

  it('treats a zero-sub-scenario question as complete rather than dividing by zero', () => {
    expect(questionCoverageStatus(0, 0)).toBe('complete');
  });
});

describe('groupCoverageStatus', () => {
  it('is complete only when every question is complete', () => {
    expect(groupCoverageStatus(['complete', 'complete'])).toBe('complete');
  });

  it('is empty only when every question is empty', () => {
    expect(groupCoverageStatus(['empty', 'empty'])).toBe('empty');
  });

  it('is partial for any mix', () => {
    expect(groupCoverageStatus(['complete', 'empty'])).toBe('partial');
    expect(groupCoverageStatus(['complete', 'partial'])).toBe('partial');
  });

  it('defaults to complete for an empty group', () => {
    expect(groupCoverageStatus([])).toBe('complete');
  });
});

describe('computeCognitiveActivityAverages', () => {
  const questions = [
    question({ id: 'q1', sortOrder: 0, cognitiveActivity: 'Intent' }),
    question({ id: 'q2', sortOrder: 1, cognitiveActivity: 'Awareness' }),
    question({ id: 'q3', sortOrder: 2, cognitiveActivity: 'Awareness' }),
  ];

  function score(questionId: string, compensatedScore: number | null): QuestionScore {
    return { questionId, subScenarioId: 'sub-1', originalScore: compensatedScore, compensatedScore };
  }

  it('averages compensatedScore per Cognitive Activity, across multiple questions/sub-scenarios in the same group', () => {
    const result = computeCognitiveActivityAverages(questions, [
      score('q1', 4),
      score('q2', 2),
      score('q3', 4),
    ]);
    expect(result).toEqual([
      { axis: 'Intent', value: 4 },
      { axis: 'Awareness', value: 3 },
    ]);
  });

  it('excludes a group whose every cell is skipped, rather than plotting it as 0', () => {
    const result = computeCognitiveActivityAverages(questions, [
      score('q1', null),
      score('q2', 2),
      score('q3', null),
    ]);
    expect(result).toEqual([{ axis: 'Awareness', value: 2 }]);
  });
});
