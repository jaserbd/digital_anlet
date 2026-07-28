import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  getQuestionnaireByCode,
  listQuestionnaires,
  QuestionnaireNotFoundError,
  setAcceptingResponses,
} from './questionnaire.service';

export async function listQuestionnairesHandler(_req: Request, res: Response) {
  res.json(await listQuestionnaires());
}

export async function getQuestionnaireHandler(req: Request, res: Response) {
  const code = req.params.code;
  if (typeof code !== 'string') {
    res.status(400).json({ error: 'Invalid questionnaire code' });
    return;
  }

  try {
    const questionnaire = await getQuestionnaireByCode(code);
    res.json(questionnaire);
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}

const setAcceptingResponsesSchema = z.object({ acceptingResponses: z.boolean() });

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
    await setAcceptingResponses(code, parsed.data.acceptingResponses);
    res.status(204).end();
  } catch (err) {
    if (err instanceof QuestionnaireNotFoundError) {
      res.status(404).json({ error: 'Questionnaire not found' });
      return;
    }
    throw err;
  }
}
