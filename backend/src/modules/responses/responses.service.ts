import type { AnswerOption, ResponseDto, ScoreResultDto } from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import {
  computeScoreResult,
  type ScoringAnswerInput,
  type ScoringQuestionInput,
  type ScoringSubScenarioInput,
} from '../scoring/scoring';
import { QuestionnaireNotFoundError } from '../questionnaire/questionnaire.service';

export class ResponseNotFoundError extends Error {}
export class ForbiddenError extends Error {}
export class ResponseAlreadySubmittedError extends Error {}
export class IncompleteResponseError extends Error {}
export class ResultNotAvailableError extends Error {}

function toResponseDto(response: {
  id: string;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  questionnaire: { code: string };
  answers: { questionId: string; subScenarioId: string; selectedOption: AnswerOption }[];
}): ResponseDto {
  return {
    id: response.id,
    status: response.status,
    questionnaireCode: response.questionnaire.code,
    answers: response.answers.map((a) => ({
      questionId: a.questionId,
      subScenarioId: a.subScenarioId,
      selectedOption: a.selectedOption,
    })),
  };
}

async function loadOwnedResponse(responseId: string, userId: string) {
  const response = await prisma.questionnaireResponse.findUnique({
    where: { id: responseId },
    include: { questionnaire: true, answers: true },
  });
  if (!response) {
    throw new ResponseNotFoundError();
  }
  if (response.userId !== userId) {
    throw new ForbiddenError();
  }
  return response;
}

/**
 * Returns the user's existing response for this questionnaire (IN_PROGRESS or
 * SUBMITTED) if one exists, creating a new one only if they've never started it.
 * Single-shot for MVP — see CLAUDE.md/plan: retake support is a later phase, so this
 * deliberately does not create a second response once one has been submitted. The
 * caller (QuestionnairePage) redirects to /results when it sees a SUBMITTED response.
 */
export async function getOrCreateResponse(
  userId: string,
  questionnaireCode: string,
): Promise<ResponseDto> {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { code: questionnaireCode },
  });
  if (!questionnaire || !questionnaire.isActive) {
    throw new QuestionnaireNotFoundError();
  }

  const existing = await prisma.questionnaireResponse.findFirst({
    where: { userId, questionnaireId: questionnaire.id },
    orderBy: { createdAt: 'desc' },
    include: { questionnaire: true, answers: true },
  });
  if (existing) {
    return toResponseDto(existing);
  }

  const created = await prisma.questionnaireResponse.create({
    data: { userId, questionnaireId: questionnaire.id },
    include: { questionnaire: true, answers: true },
  });
  return toResponseDto(created);
}

export async function upsertAnswer(
  responseId: string,
  userId: string,
  input: { questionId: string; subScenarioId: string; selectedOption: AnswerOption },
): Promise<void> {
  const response = await loadOwnedResponse(responseId, userId);
  if (response.status !== 'IN_PROGRESS') {
    throw new ResponseAlreadySubmittedError();
  }

  await prisma.answer.upsert({
    where: {
      responseId_questionId_subScenarioId: {
        responseId,
        questionId: input.questionId,
        subScenarioId: input.subScenarioId,
      },
    },
    update: { selectedOption: input.selectedOption },
    create: {
      responseId,
      questionId: input.questionId,
      subScenarioId: input.subScenarioId,
      selectedOption: input.selectedOption,
    },
  });
}

export async function submitResponse(responseId: string, userId: string): Promise<ScoreResultDto> {
  const response = await loadOwnedResponse(responseId, userId);
  if (response.status !== 'IN_PROGRESS') {
    throw new ResponseAlreadySubmittedError();
  }

  const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
    where: { id: response.questionnaireId },
    include: { questions: true, subScenarios: true },
  });

  const expectedAnswerCount = questionnaire.questions.length * questionnaire.subScenarios.length;
  if (response.answers.length < expectedAnswerCount) {
    throw new IncompleteResponseError();
  }

  const questions: ScoringQuestionInput[] = questionnaire.questions.map((q) => ({
    id: q.id,
    weight: Number(q.weight),
    optionCriteria: {
      ...(q.optionACriteria != null && { A: Number(q.optionACriteria) }),
      ...(q.optionBCriteria != null && { B: Number(q.optionBCriteria) }),
      ...(q.optionCCriteria != null && { C: Number(q.optionCCriteria) }),
      ...(q.optionDCriteria != null && { D: Number(q.optionDCriteria) }),
    },
    includeInE2ECheck: q.includeInE2ECheck,
  }));

  const subScenarios: ScoringSubScenarioInput[] = questionnaire.subScenarios.map((s) => ({
    id: s.id,
    code: s.code,
    faultDistributionWeight: Number(s.faultDistributionWeight),
  }));

  const answers: ScoringAnswerInput[] = response.answers.map((a) => ({
    questionId: a.questionId,
    subScenarioId: a.subScenarioId,
    selectedOption: a.selectedOption,
  }));

  const result = computeScoreResult({ questions, subScenarios, answers });

  const subScenarioIdByCode = new Map(questionnaire.subScenarios.map((s) => [s.code, s.id]));

  await prisma.$transaction([
    prisma.questionnaireResponse.update({
      where: { id: responseId },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    }),
    prisma.scoreResult.create({
      data: {
        responseId,
        finalScore: result.finalScore,
        e2eAutomationRate: result.e2eAutomationRate,
        subScenarioScores: {
          create: result.subScenarioScores.map((s) => ({
            subScenarioId: subScenarioIdByCode.get(s.subScenarioCode)!,
            overallScore: s.overallScore,
            e2eAchieved: s.e2eAchieved,
          })),
        },
      },
    }),
  ]);

  return result;
}

export async function getResponse(responseId: string, userId: string): Promise<ResponseDto> {
  const response = await loadOwnedResponse(responseId, userId);
  return toResponseDto(response);
}

export async function getResult(responseId: string, userId: string): Promise<ScoreResultDto> {
  await loadOwnedResponse(responseId, userId);

  const result = await prisma.scoreResult.findUnique({
    where: { responseId },
    include: { subScenarioScores: { include: { subScenario: true } } },
  });
  if (!result) {
    throw new ResultNotAvailableError();
  }

  return {
    finalScore: Number(result.finalScore),
    e2eAutomationRate: Number(result.e2eAutomationRate),
    subScenarioScores: result.subScenarioScores.map((s) => ({
      subScenarioCode: s.subScenario.code,
      overallScore: Number(s.overallScore),
      e2eAchieved: s.e2eAchieved,
    })),
  };
}
