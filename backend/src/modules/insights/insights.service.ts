import type {
  AnswerDistributionEntryDto,
  AnswerOption,
  AnswerOptionCounts,
  OrganizationQuestionnaireSummaryDto,
  RespondentSummaryDto,
} from '@anlet/shared';
import { prisma } from '../../lib/prisma';

export class QuestionnaireNotFoundError extends Error {}

function emptyCounts(): AnswerOptionCounts {
  return { A: 0, B: 0, C: 0, D: 0 };
}

/**
 * Per-question, per-sub-scenario answer distribution and per-respondent status for an
 * organization — the data behind the Executive's "how many people picked option A for
 * question 1" view (REQUIREMENTS.md, Group2_Executive). Distribution counts are scoped to
 * SUBMITTED responses only, so in-progress answers don't skew the picture. Callers are
 * responsible for authorizing that `organizationId` is one the requester may view.
 */
export async function getOrganizationQuestionnaireSummary(
  organizationId: string,
  questionnaireCode: string,
): Promise<OrganizationQuestionnaireSummaryDto> {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { code: questionnaireCode },
    include: {
      questions: { orderBy: { sortOrder: 'asc' } },
      subScenarios: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }

  const users = await prisma.user.findMany({
    where: { organizationId, role: 'NORMAL_USER' },
    orderBy: { email: 'asc' },
    include: {
      responses: {
        where: { questionnaireId: questionnaire.id },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { result: true },
      },
    },
  });

  const respondents: RespondentSummaryDto[] = users.map((u) => {
    const latest = u.responses[0];
    return {
      userId: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      status: latest?.status ?? 'NOT_STARTED',
      finalScore: latest?.result ? Number(latest.result.finalScore) : null,
    };
  });

  const grouped = await prisma.answer.groupBy({
    by: ['questionId', 'subScenarioId', 'selectedOption'],
    where: {
      response: { questionnaireId: questionnaire.id, status: 'SUBMITTED', user: { organizationId } },
    },
    _count: { _all: true },
  });

  const countsByKey = new Map<string, AnswerOptionCounts>();
  for (const row of grouped) {
    const key = `${row.questionId}:${row.subScenarioId}`;
    const counts = countsByKey.get(key) ?? emptyCounts();
    counts[row.selectedOption as AnswerOption] = row._count._all;
    countsByKey.set(key, counts);
  }

  const answerDistribution: AnswerDistributionEntryDto[] = [];
  for (const question of questionnaire.questions) {
    for (const subScenario of questionnaire.subScenarios) {
      const key = `${question.id}:${subScenario.id}`;
      answerDistribution.push({
        questionId: question.id,
        subScenarioId: subScenario.id,
        counts: countsByKey.get(key) ?? emptyCounts(),
      });
    }
  }

  return { questionnaireCode: questionnaire.code, respondents, answerDistribution };
}
