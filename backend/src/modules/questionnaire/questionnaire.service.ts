import type { AnswerOption, QuestionDto, QuestionnaireDto } from '@anlet/shared';
import { prisma } from '../../lib/prisma';

export class QuestionnaireNotFoundError extends Error {}

const OPTION_LETTERS: AnswerOption[] = ['A', 'B', 'C', 'D'];

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
    // Criteria numbers are deliberately not sent to the client — otherwise a user could
    // infer which option scores highest (always A, per the domain model) without needing
    // to reason about the questionnaire at all.
    const optionText = [q.optionAText, q.optionBText, q.optionCText, q.optionDText];
    const options = OPTION_LETTERS.map((option, i) => ({ option, text: optionText[i] })).filter(
      (o): o is { option: AnswerOption; text: string } => o.text != null,
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
    };
  });

  return {
    id: questionnaire.id,
    code: questionnaire.code,
    name: questionnaire.name,
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
