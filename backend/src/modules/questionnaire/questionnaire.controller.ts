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

export async function listQuestionnairesHandler(_req: Request, res: Response) {
  res.json(await listQuestionnaires());
}

export async function listHvsEntriesHandler(_req: Request, res: Response) {
  res.json(await listHvsEntries());
}

export async function getQuestionnaireHandler(req: Request, res: Response) {
  const code = req.params.code;
  if (typeof code !== 'string') {
    res.status(400).json({ error: 'Invalid questionnaire code' });
    return;
  }

  try {
    const questionnaire = await getQuestionnaireByCode(code, req.user!.organizationId);
    res.json(questionnaire);
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}

// Admin-only: reads a specific organization's accepting-responses flag (used by
// QuestionnaireSettingsSection to populate its toggle after picking an org).
export async function getAcceptingResponsesHandler(req: Request, res: Response) {
  const code = req.params.code;
  const organizationId = req.query.organizationId;
  if (typeof code !== 'string' || typeof organizationId !== 'string') {
    res.status(400).json({ error: 'organizationId query param is required' });
    return;
  }

  try {
    const questionnaire = await prisma.questionnaire.findUnique({ where: { code } });
    if (!questionnaire) {
      throw new QuestionnaireNotFoundError();
    }
    const acceptingResponses = await getAcceptingResponses(questionnaire.id, organizationId);
    res.json({ questionnaireCode: code, organizationId, acceptingResponses });
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

  try {
    await setAcceptingResponses(code, parsed.data.organizationId, parsed.data.acceptingResponses);
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
