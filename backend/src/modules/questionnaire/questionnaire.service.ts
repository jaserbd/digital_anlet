import type { AnswerOption, QuestionDto, QuestionnaireDto, QuestionnaireSummaryDto } from '@anlet/shared';
import { prisma } from '../../lib/prisma';

export class QuestionnaireNotFoundError extends Error {}

const OPTION_LETTERS: AnswerOption[] = ['A', 'B', 'C', 'D'];

export async function listQuestionnaires(): Promise<QuestionnaireSummaryDto[]> {
  const questionnaires = await prisma.questionnaire.findMany({
    where: { isActive: true },
    orderBy: [{ networkType: 'asc' }, { hvsCategory: 'asc' }],
  });
  return questionnaires.map((q) => ({
    code: q.code,
    name: q.name,
    networkType: q.networkType,
    hvsCategory: q.hvsCategory,
  }));
}

export async function getQuestionnaireByCode(code: string): Promise<QuestionnaireDto> {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { code },
    include: {
      subScenarios: { orderBy: { sortOrder: 'asc' } },
      questions: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!questionnaire || !questionnaire.isActive) {
    throw new QuestionnaireNotFoundError();
  }

  const questions: QuestionDto[] = questionnaire.questions.map((q) => {
    // Criteria numbers are intentionally exposed to the client (SECOND_REVIEW.md item 6) so
    // users can see each option's score while answering — a deliberate reversal of the prior
    // anti-gaming stance (criteria used to be stripped so users couldn't just pick the
    // highest-scoring option without reasoning about the question).
    const optionText = [q.optionAText, q.optionBText, q.optionCText, q.optionDText];
    const optionCriteria = [q.optionACriteria, q.optionBCriteria, q.optionCCriteria, q.optionDCriteria];
    const options = OPTION_LETTERS.map((option, i) => ({
      option,
      text: optionText[i],
      criteria: optionCriteria[i] != null ? Number(optionCriteria[i]) : null,
    })).filter(
      (o): o is { option: AnswerOption; text: string; criteria: number } =>
        o.text != null && o.criteria != null,
    );
    return {
      id: q.id,
      sortOrder: q.sortOrder,
      cognitiveActivity: q.cognitiveActivity,
      serviceCapability: q.serviceCapability,
      questionText: q.questionText,
      weight: Number(q.weight),
      includeInE2ECheck: q.includeInE2ECheck,
      options,
      answeringGuideline: q.answeringGuideline,
    };
  });

  return {
    id: questionnaire.id,
    code: questionnaire.code,
    name: questionnaire.name,
    networkType: questionnaire.networkType,
    hvsCategory: questionnaire.hvsCategory,
    hasE2ECheck: questionnaire.hasE2ECheck,
    guidelineText: questionnaire.guidelineText,
    subScenarios: questionnaire.subScenarios.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description ?? '',
      faultDistributionWeight: Number(s.faultDistributionWeight),
      sortOrder: s.sortOrder,
    })),
    questions,
  };
}
