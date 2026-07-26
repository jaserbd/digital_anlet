import type { Request, Response } from 'express';
import { getQuestionnaireByCode, listQuestionnaires, QuestionnaireNotFoundError } from './questionnaire.service';

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
