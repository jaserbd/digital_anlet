import type { Request, Response } from 'express';
import { z } from 'zod';
import { requireParam } from '../../lib/params';
import { QuestionnaireNotFoundError } from '../questionnaire/questionnaire.service';
import {
  ForbiddenError,
  IncompleteResponseError,
  ResponseAlreadySubmittedError,
  ResponseNotFoundError,
  ResultNotAvailableError,
  getOrCreateResponse,
  getResponse,
  getResult,
  submitResponse,
  upsertAnswer,
} from './responses.service';

const createResponseSchema = z.object({
  questionnaireCode: z.string().min(1),
});

const upsertAnswerSchema = z.object({
  questionId: z.string().min(1),
  subScenarioId: z.string().min(1),
  selectedOption: z.enum(['A', 'B', 'C', 'D']),
});

function handleKnownErrors(err: unknown, res: Response): boolean {
  if (err instanceof ResponseNotFoundError || err instanceof QuestionnaireNotFoundError) {
    res.status(404).json({ error: 'Not found' });
    return true;
  }
  if (err instanceof ForbiddenError) {
    res.status(403).json({ error: 'Forbidden' });
    return true;
  }
  if (err instanceof ResponseAlreadySubmittedError) {
    res.status(409).json({ error: 'Response has already been submitted' });
    return true;
  }
  if (err instanceof IncompleteResponseError) {
    res.status(400).json({ error: 'All questions must be answered before submitting' });
    return true;
  }
  if (err instanceof ResultNotAvailableError) {
    res.status(404).json({ error: 'Result not available' });
    return true;
  }
  return false;
}

export async function createResponseHandler(req: Request, res: Response) {
  const parsed = createResponseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    const response = await getOrCreateResponse(
      req.user!.sub,
      parsed.data.questionnaireCode,
    );
    res.status(200).json(response);
  } catch (err) {
    if (!handleKnownErrors(err, res)) throw err;
  }
}

export async function getResponseHandler(req: Request, res: Response) {
  try {
    const response = await getResponse(requireParam(req, 'id'), req.user!.sub);
    res.json(response);
  } catch (err) {
    if (!handleKnownErrors(err, res)) throw err;
  }
}

export async function upsertAnswerHandler(req: Request, res: Response) {
  const parsed = upsertAnswerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    await upsertAnswer(requireParam(req, 'id'), req.user!.sub, parsed.data);
    res.status(204).end();
  } catch (err) {
    if (!handleKnownErrors(err, res)) throw err;
  }
}

export async function submitResponseHandler(req: Request, res: Response) {
  try {
    const result = await submitResponse(requireParam(req, 'id'), req.user!.sub);
    res.json(result);
  } catch (err) {
    if (!handleKnownErrors(err, res)) throw err;
  }
}

export async function getResultHandler(req: Request, res: Response) {
  try {
    const result = await getResult(requireParam(req, 'id'), req.user!.sub);
    res.json(result);
  } catch (err) {
    if (!handleKnownErrors(err, res)) throw err;
  }
}
