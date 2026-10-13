import type {
  AnswerOption,
  EffectivenessIndicatorDto,
  HvsListItemDto,
  QuestionDto,
  QuestionOptionDto,
  QuestionnaireDto,
  QuestionnaireSummaryDto,
} from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { HVS_GROUPS } from './hvsGroups';

export class QuestionnaireNotFoundError extends Error {}
export class OrganizationNotFoundError extends Error {}

const OPTION_LETTERS: AnswerOption[] = ['A', 'B', 'C', 'D'];

// Prisma Decimal columns (or plain numbers) — Number() converts either.
type NumberLike = number | { toString(): string };

// The option A-D text/criteria column shape shared by Question and EffectivenessIndicator.
interface OptionColumns {
  optionAText: string;
  optionBText: string | null;
  optionCText: string | null;
  optionDText: string | null;
  optionACriteria: NumberLike | null;
  optionBCriteria: NumberLike | null;
  optionCCriteria: NumberLike | null;
  optionDCriteria: NumberLike | null;
}

// Criteria numbers are intentionally exposed to the client (SECOND_REVIEW.md item 6) so
// users can see each option's score while answering — a deliberate reversal of the prior
// anti-gaming stance (criteria used to be stripped so users couldn't just pick the
// highest-scoring option without reasoning about the question).
function toOptionDtos(row: OptionColumns): QuestionOptionDto[] {
  const optionText = [row.optionAText, row.optionBText, row.optionCText, row.optionDText];
  const optionCriteria = [row.optionACriteria, row.optionBCriteria, row.optionCCriteria, row.optionDCriteria];
  return OPTION_LETTERS.map((option, i) => ({
    option,
    text: optionText[i],
    criteria: optionCriteria[i] != null ? Number(optionCriteria[i]) : null,
  })).filter(
    (o): o is { option: AnswerOption; text: string; criteria: number } => o.text != null && o.criteria != null,
  );
}

/**
 * The questionnaire ids a project works with (PROJECT_QUESTIONNAIRES_PLAN.md), or null (= every
 * questionnaire) for no project — a membership outside projects, or the admin context.
 */
export async function getAllowedQuestionnaireIds(projectId: string | null): Promise<Set<string> | null> {
  if (!projectId) return null;
  const rows = await prisma.projectQuestionnaire.findMany({ where: { projectId }, select: { questionnaireId: true } });
  return new Set(rows.map((q) => q.questionnaireId));
}

// `projectId`: limit the listing to that project's questionnaires (the caller's active
// membership's project); null for the admin context and project-less memberships.
export async function listQuestionnaires(projectId: string | null = null): Promise<QuestionnaireSummaryDto[]> {
  const allowed = await getAllowedQuestionnaireIds(projectId);
  const questionnaires = await prisma.questionnaire.findMany({
    where: { isActive: true, ...(allowed ? { id: { in: [...allowed] } } : {}) },
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
export async function listHvsEntries(projectId: string | null = null): Promise<HvsListItemDto[]> {
  const questionnaires = await listQuestionnaires(projectId);
  const available = new Set(questionnaires.map((q) => q.code));
  const grouped = new Set(HVS_GROUPS.flatMap((g) => g.questionnaireCodes));
  // A group is selected for a project as a whole (both halves), so it's listed only when all of
  // its questionnaires are available.
  const groups = HVS_GROUPS.filter((g) => g.questionnaireCodes.every((code) => available.has(code)));
  const items: HvsListItemDto[] = groups.map((g) => ({
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
 * Accepting-responses flag (THIRD_REVIEW.md item 7) — per project + organization for memberships
 * in a project (QuestionnaireProjectSetting, PROJECTS_V2_PLAN.md), per organization otherwise
 * (QuestionnaireOrgSetting). Defaults to true when no row exists.
 */
export async function getAcceptingResponses(
  questionnaireId: string,
  organizationId: string,
  projectId: string | null = null,
): Promise<boolean> {
  const setting = projectId
    ? await prisma.questionnaireProjectSetting.findUnique({
        where: { projectId_organizationId_questionnaireId: { projectId, organizationId, questionnaireId } },
      })
    : await prisma.questionnaireOrgSetting.findUnique({
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
  projectId: string | null = null,
): Promise<void> {
  const questionnaire = await prisma.questionnaire.findUnique({ where: { code } });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) {
    throw new OrganizationNotFoundError();
  }
  if (projectId) {
    await prisma.questionnaireProjectSetting.upsert({
      where: {
        projectId_organizationId_questionnaireId: { projectId, organizationId, questionnaireId: questionnaire.id },
      },
      update: { acceptingResponses },
      create: { projectId, organizationId, questionnaireId: questionnaire.id, acceptingResponses },
    });
    return;
  }
  await prisma.questionnaireOrgSetting.upsert({
    where: { questionnaireId_organizationId: { questionnaireId: questionnaire.id, organizationId } },
    update: { acceptingResponses },
    create: { questionnaireId: questionnaire.id, organizationId, acceptingResponses },
  });
}

export async function getQuestionnaireByCode(
  code: string,
  organizationId: string,
  projectId: string | null = null,
): Promise<QuestionnaireDto> {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { code },
    include: {
      subScenarios: { orderBy: { sortOrder: 'asc' } },
      questions: { orderBy: { sortOrder: 'asc' } },
      effectivenessIndicators: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!questionnaire || !questionnaire.isActive) {
    throw new QuestionnaireNotFoundError();
  }

  const acceptingResponses = await getAcceptingResponses(questionnaire.id, organizationId, projectId);

  const questions: QuestionDto[] = questionnaire.questions.map((q) => {
    const options = toOptionDtos(q);
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
    effectivenessIndicators: questionnaire.effectivenessIndicators.map(
      (k): EffectivenessIndicatorDto => ({
        id: k.id,
        sortOrder: k.sortOrder,
        name: k.name,
        description: k.description,
        weight: Number(k.weight),
        options: toOptionDtos(k),
      }),
    ),
    keiNote: questionnaire.keiNote,
  };
}
