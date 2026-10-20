import { describe, expect, it } from 'vitest';
import type { CommentDrilldownEntryDto, QuestionDto, SubScenarioDto } from '@anlet/shared';
import { buildCommentCollectionRows } from '../components/CommentCollectionTable';
import { formatCommentSubScenarios } from './answerDistribution';
import { cognitiveFilterLabel } from './organizationReport';

function question(id: string, cognitiveActivity: string, serviceCapability: string): QuestionDto {
  return {
    id,
    sortOrder: 0,
    cognitiveActivity,
    serviceCapability,
    questionText: 'Question?',
    weight: 0.5,
    includeInE2ECheck: true,
    options: [],
    answeringGuideline: null,
  };
}

const questions = [question('q1', 'Intent', 'Intent-driven'), question('q2', 'Awareness', 'Fault Prediction')];
const subScenarios = [
  { id: 's1', code: 'EQUIPMENT', name: 'Equipment', faultDistributionWeight: 0.5, sortOrder: 0, category: null },
  { id: 's2', code: 'SECURITY', name: 'Security', faultDistributionWeight: 0.5, sortOrder: 1, category: null },
] as SubScenarioDto[];

function comment(questionId: string, subScenarioIds: string[], commentText: string, appliesToNone = false): CommentDrilldownEntryDto {
  return {
    questionId,
    subScenarioIds,
    appliesToNone,
    commentText,
    respondent: { userId: 'u', email: 'Participant 1', opCoId: null, opCoName: null, country: null, workingDomain: null, designation: null },
  };
}

// EXECUTIVE_FEEDBACK_PLAN.md: a comment has to be traceable to its question.
describe('Comment Collection rows', () => {
  it('name the numbered question and list rows in question order', () => {
    const rows = buildCommentCollectionRows(
      [comment('q2', ['s2'], 'later question'), comment('q1', ['s1', 's2'], 'first question')],
      questions,
      subScenarios,
    );
    expect(rows.map((r) => [r.question, r.subScenario, r.comment])).toEqual([
      ['Q1 · Intent-driven', 'Equipment', 'first question'],
      ['Q1 · Intent-driven', 'Security', 'first question'],
      ['Q2 · Fault Prediction', 'Security', 'later question'],
    ]);
  });
});

describe('formatCommentSubScenarios', () => {
  it('joins tagged sub-scenarios, or names a general remark', () => {
    expect(formatCommentSubScenarios(comment('q1', ['s1', 's2'], 'x'), subScenarios)).toBe('Equipment, Security');
    expect(formatCommentSubScenarios(comment('q1', [], 'x', true), subScenarios)).toBe('None of the sub-scenarios');
    expect(formatCommentSubScenarios(comment('q1', [], 'x'), subScenarios)).toBe('—');
  });
});

describe('cognitiveFilterLabel', () => {
  it('describes the spider chart filter for the PDF', () => {
    expect(cognitiveFilterLabel({ opCoId: '', country: '' }, () => undefined)).toBe('All NatCos · All countries');
    expect(cognitiveFilterLabel({ opCoId: 'o1', country: 'Germany' }, () => 'NatCo DE')).toBe('NatCo DE · Germany');
  });
});
