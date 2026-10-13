import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  getAcceptingResponses,
  getQuestionnaireByCode,
  listHvsEntries,
  listQuestionnaires,
  OrganizationNotFoundError,
  QuestionnaireNotFoundError,
  setAcceptingResponses,
} from './questionnaire.service';
import { prisma } from '../../lib/prisma';
import { optionalProjectId, requireManageOrganization } from '../../lib/projectAccess';

// Project members see only their project's questionnaires (PROJECT_QUESTIONNAIRES_PLAN.md); the
// Application Admin context (projectId null) and project-less memberships see all.
function listingScope(req: Request): string | null {
  return req.user!.projectId;
}

export async function listQuestionnairesHandler(req: Request, res: Response) {
  res.json(await listQuestionnaires(listingScope(req)));
}

export async function listHvsEntriesHandler(req: Request, res: Response) {
  res.json(await listHvsEntries(listingScope(req)));
}

export async function getQuestionnaireHandler(req: Request, res: Response) {
  const code = req.params.code;
  if (typeof code !== 'string') {
    res.status(400).json({ error: 'Invalid questionnaire code' });
    return;
  }

  try {
    const questionnaire = await getQuestionnaireByCode(code, req.user!.organizationId, req.user!.projectId);
    res.json(questionnaire);
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}

// Reads an organization's accepting-responses flag — per project when `projectId` is given
// (PROJECTS_V2_PLAN.md). Used by QuestionnaireSettingsSection after picking the organization.
export async function getAcceptingResponsesHandler(req: Request, res: Response) {
  const code = req.params.code;
  const organizationId = req.query.organizationId;
  if (typeof code !== 'string' || typeof organizationId !== 'string') {
    res.status(400).json({ error: 'organizationId query param is required' });
    return;
  }
  const projectId = optionalProjectId(req.query.projectId);
  if (!requireManageOrganization(req, res, organizationId, projectId)) return;

  try {
    const questionnaire = await prisma.questionnaire.findUnique({ where: { code } });
    if (!questionnaire) {
      throw new QuestionnaireNotFoundError();
    }
    const acceptingResponses = await getAcceptingResponses(questionnaire.id, organizationId, projectId);
    res.json({ questionnaireCode: code, organizationId, projectId, acceptingResponses });
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}

const setAcceptingResponsesSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
  acceptingResponses: z.boolean(),
});

export async function setAcceptingResponsesHandler(req: Request, res: Response) {
  const code = req.params.code;
  if (typeof code !== 'string') {
    res.status(400).json({ error: 'Invalid questionnaire code' });
    return;
  }
  const parsed = setAcceptingResponsesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const projectId = parsed.data.projectId ?? null;
  if (!requireManageOrganization(req, res, parsed.data.organizationId, projectId)) return;

  try {
    await setAcceptingResponses(code, parsed.data.organizationId, parsed.data.acceptingResponses, projectId);
    res.status(204).end();
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    if (err instanceof OrganizationNotFoundError) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }
    throw err;
  }
}
