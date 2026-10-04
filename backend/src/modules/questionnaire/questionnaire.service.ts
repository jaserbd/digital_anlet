import type { AnswerOption, HvsListItemDto, QuestionDto, QuestionnaireDto, QuestionnaireSummaryDto } from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { HVS_GROUPS } from './hvsGroups';

export class QuestionnaireNotFoundError extends Error {}
export class OrganizationNotFoundError extends Error {}

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

/**
 * Domain -> HVS picker listing (FORTH_REVIEW.md items 5/6) — additive alongside
 * listQuestionnaires, which keeps driving the assessment-taking picker (DomainPickerPage)
 * unchanged, since Core Fault Management and Stability must stay separately answerable
 * there. This is for results-viewing/benchmarking contexts, where the two should present as
 * one "Core Network Fault Management & Stability Assessment" HVS entry.
 */
export async function listHvsEntries(): Promise<HvsListItemDto[]> {
  const questionnaires = await listQuestionnaires();
  const grouped = new Set(HVS_GROUPS.flatMap((g) => g.questionnaireCodes));
  const items: HvsListItemDto[] = HVS_GROUPS.map((g) => ({
    kind: 'group' as const,
    key: g.groupCode,
    name: g.groupName,
    networkType: g.networkType,
    questionnaireCodes: g.questionnaireCodes,
  }));
  for (const q of questionnaires) {
    if (grouped.has(q.code)) continue;
    items.push({ kind: 'single', key: q.code, name: q.name, networkType: q.networkType, questionnaireCodes: [q.code] });
  }
  return items;
}

/**
 * Per-(questionnaire, organization) accepting-responses flag (THIRD_REVIEW.md item 7) —
 * defaults to true when no QuestionnaireOrgSetting row exists (shouldn't normally happen,
 * every org/questionnaire pair is backfilled on creation — see organizations.service.ts and
 * seed.ts — but this keeps the read defensive rather than throwing).
 */
export async function getAcceptingResponses(
  questionnaireId: string,
  organizationId: string,
): Promise<boolean> {
  const setting = await prisma.questionnaireOrgSetting.findUnique({
    where: { questionnaireId_organizationId: { questionnaireId, organizationId } },
  });
  return setting?.acceptingResponses ?? true;
}

/** Admin-only: toggles whether a questionnaire still accepts response mutations/submissions
 * for one specific organization — see responses.service.ts's AcceptanceClosedError. */
export async function setAcceptingResponses(
  code: string,
  organizationId: string,
  acceptingResponses: boolean,
): Promise<void> {
  const questionnaire = await prisma.questionnaire.findUnique({ where: { code } });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) {
    throw new OrganizationNotFoundError();
  }
  await prisma.questionnaireOrgSetting.upsert({
    where: { questionnaireId_organizationId: { questionnaireId: questionnaire.id, organizationId } },
    update: { acceptingResponses },
    create: { questionnaireId: questionnaire.id, organizationId, acceptingResponses },
  });
}

export async function getQuestionnaireByCode(code: string, organizationId: string): Promise<QuestionnaireDto> {
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

  const acceptingResponses = await getAcceptingResponses(questionnaire.id, organizationId);

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
    acceptingResponses,
    subScenarios: questionnaire.subScenarios.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description ?? '',
      category: s.category,
      faultDistributionWeight: Number(s.faultDistributionWeight),
      sortOrder: s.sortOrder,
    })),
    questions,
  };
}
