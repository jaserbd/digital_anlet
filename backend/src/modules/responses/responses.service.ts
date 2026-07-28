import type {
  AnswerOption,
  CoreDomainSummaryDto,
  QuestionCommentDto,
  ResponseDto,
  ScoreResultDto,
  UncoveredSkipDto,
} from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { round4 } from '../../lib/rounding';
import {
  computeScoreResult,
  type ScoringAnswerInput,
  type ScoringQuestionInput,
  type ScoringSubScenarioInput,
} from '../scoring/scoring';
import { QuestionnaireNotFoundError } from '../questionnaire/questionnaire.service';

const CORE_FAULT_MANAGEMENT_CODE = 'CORE_FM_GB1059B';
const CORE_STABILITY_CODE = 'CORE_STABILITY_GB1059B';

export class ResponseNotFoundError extends Error {}
export class ForbiddenError extends Error {}
export class ResponseAlreadySubmittedError extends Error {}
export class ResultNotAvailableError extends Error {}

// Thrown at submit time when one or more unanswered (question, subScenario) pairs have no
// covering comment — carries the specific list so the frontend can show exactly what's
// missing (mirrors the client-side warning computed from the same data). An unanswered pair
// that *does* have a covering comment is a "skip" and submits fine — see schema.prisma's
// QuestionComment doc comment for the terminology distinction.
export class UncoveredSkipError extends Error {
  constructor(public readonly missing: UncoveredSkipDto[]) {
    super(`${missing.length} unanswered question(s) are missing a covering comment`);
  }
}

type CommentWithTags = {
  questionId: string;
  commentText: string;
  appliesToNone: boolean;
  subScenarios: { subScenarioId: string }[];
};

function toCommentDto(comment: CommentWithTags): QuestionCommentDto {
  return {
    questionId: comment.questionId,
    commentText: comment.commentText,
    appliesToNone: comment.appliesToNone,
    subScenarioIds: comment.subScenarios.map((s) => s.subScenarioId),
  };
}

function toResponseDto(response: {
  id: string;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  questionnaire: { code: string };
  answers: { questionId: string; subScenarioId: string; selectedOption: AnswerOption }[];
  comments: CommentWithTags[];
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
    comments: response.comments.map(toCommentDto),
  };
}

const RESPONSE_INCLUDE = {
  questionnaire: true,
  answers: true,
  comments: { include: { subScenarios: true } },
} as const;

async function loadOwnedResponse(responseId: string, userId: string) {
  const response = await prisma.questionnaireResponse.findUnique({
    where: { id: responseId },
    include: RESPONSE_INCLUDE,
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
    include: RESPONSE_INCLUDE,
  });
  if (existing) {
    return toResponseDto(existing);
  }

  const created = await prisma.questionnaireResponse.create({
    data: { userId, questionnaireId: questionnaire.id },
    include: RESPONSE_INCLUDE,
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

// Un-answers a (question, subScenario) cell — lets a user who already picked an option
// revert to "unanswered" (see QuestionCard.tsx's "not answered" dropdown option). A no-op if
// the cell was never answered.
export async function deleteAnswer(
  responseId: string,
  userId: string,
  input: { questionId: string; subScenarioId: string },
): Promise<void> {
  const response = await loadOwnedResponse(responseId, userId);
  if (response.status !== 'IN_PROGRESS') {
    throw new ResponseAlreadySubmittedError();
  }

  await prisma.answer.deleteMany({
    where: { responseId, questionId: input.questionId, subScenarioId: input.subScenarioId },
  });
}

export async function upsertComment(
  responseId: string,
  userId: string,
  input: {
    questionId: string;
    commentText: string;
    subScenarioIds: string[];
    appliesToNone: boolean;
  },
): Promise<void> {
  const response = await loadOwnedResponse(responseId, userId);
  if (response.status !== 'IN_PROGRESS') {
    throw new ResponseAlreadySubmittedError();
  }

  await prisma.$transaction(async (tx) => {
    const comment = await tx.questionComment.upsert({
      where: { responseId_questionId: { responseId, questionId: input.questionId } },
      update: { commentText: input.commentText, appliesToNone: input.appliesToNone },
      create: {
        responseId,
        questionId: input.questionId,
        commentText: input.commentText,
        appliesToNone: input.appliesToNone,
      },
    });
    await tx.questionCommentSubScenario.deleteMany({ where: { commentId: comment.id } });
    if (input.subScenarioIds.length > 0) {
      await tx.questionCommentSubScenario.createMany({
        data: input.subScenarioIds.map((subScenarioId) => ({ commentId: comment.id, subScenarioId })),
      });
    }
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

  const answeredKeys = new Set(response.answers.map((a) => `${a.questionId}:${a.subScenarioId}`));
  const commentCoverage = new Map<string, { appliesToNone: boolean; subScenarioIds: Set<string> }>();
  for (const comment of response.comments) {
    commentCoverage.set(comment.questionId, {
      appliesToNone: comment.appliesToNone,
      subScenarioIds: new Set(comment.subScenarios.map((s) => s.subScenarioId)),
    });
  }

  const uncovered: UncoveredSkipDto[] = [];
  for (const question of questionnaire.questions) {
    for (const subScenario of questionnaire.subScenarios) {
      if (answeredKeys.has(`${question.id}:${subScenario.id}`)) continue;
      const coverage = commentCoverage.get(question.id);
      const covered = coverage?.appliesToNone || coverage?.subScenarioIds.has(subScenario.id);
      if (!covered) {
        uncovered.push({ questionId: question.id, subScenarioId: subScenario.id });
      }
    }
  }
  if (uncovered.length > 0) {
    throw new UncoveredSkipError(uncovered);
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
        questionScores: {
          create: result.questionScores.map((qs) => ({
            questionId: qs.questionId,
            subScenarioId: qs.subScenarioId,
            originalScore: qs.originalScore,
            compensatedScore: qs.compensatedScore,
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
    include: {
      subScenarioScores: { include: { subScenario: true } },
      questionScores: true,
    },
  });
  if (!result) {
    throw new ResultNotAvailableError();
  }

  return {
    finalScore: Number(result.finalScore),
    e2eAutomationRate: Number(result.e2eAutomationRate),
    subScenarioScores: result.subScenarioScores.map((s) => ({
      subScenarioCode: s.subScenario.code,
      overallScore: s.overallScore != null ? Number(s.overallScore) : null,
      e2eAchieved: s.e2eAchieved,
    })),
    questionScores: result.questionScores.map((qs) => ({
      questionId: qs.questionId,
      subScenarioId: qs.subScenarioId,
      originalScore: qs.originalScore != null ? Number(qs.originalScore) : null,
      compensatedScore: qs.compensatedScore != null ? Number(qs.compensatedScore) : null,
    })),
  };
}

async function getLatestSubmittedResultByCode(
  userId: string,
  questionnaireCode: string,
): Promise<ScoreResultDto | null> {
  const response = await prisma.questionnaireResponse.findFirst({
    where: { userId, status: 'SUBMITTED', questionnaire: { code: questionnaireCode } },
    orderBy: { submittedAt: 'desc' },
    include: { result: { include: { subScenarioScores: { include: { subScenario: true } } } } },
  });
  if (!response?.result) {
    return null;
  }

  return {
    finalScore: Number(response.result.finalScore),
    e2eAutomationRate: Number(response.result.e2eAutomationRate),
    subScenarioScores: response.result.subScenarioScores.map((s) => ({
      subScenarioCode: s.subScenario.code,
      overallScore: s.overallScore != null ? Number(s.overallScore) : null,
      e2eAchieved: s.e2eAchieved,
    })),
    // getCoreDomainSummary (the only caller) only needs finalScore — not fetched here to
    // avoid an unused extra include.
    questionScores: [],
  };
}

/**
 * Combines a user's Core Fault Management and Core Stability results per CORE_FM.xlsx's
 * Guideline point 7: "final score = 50% * fault management score + 50% * stability
 * score." Either half may not have been submitted yet — combinedScore is only present
 * once both are.
 */
export async function getCoreDomainSummary(userId: string): Promise<CoreDomainSummaryDto> {
  const [faultManagement, stability] = await Promise.all([
    getLatestSubmittedResultByCode(userId, CORE_FAULT_MANAGEMENT_CODE),
    getLatestSubmittedResultByCode(userId, CORE_STABILITY_CODE),
  ]);

  const combinedScore =
    faultManagement && stability
      ? round4(0.5 * faultManagement.finalScore + 0.5 * stability.finalScore)
      : null;

  return { faultManagement, stability, combinedScore };
}
