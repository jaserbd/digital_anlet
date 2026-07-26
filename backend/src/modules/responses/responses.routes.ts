import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import {
  createResponseHandler,
  getResponseHandler,
  getResultHandler,
  submitResponseHandler,
  upsertAnswerHandler,
} from './responses.controller';

export const responsesRouter = Router();

responsesRouter.use(authenticate);
responsesRouter.post('/', asyncHandler(createResponseHandler));
responsesRouter.get('/:id', asyncHandler(getResponseHandler));
responsesRouter.put('/:id/answers', asyncHandler(upsertAnswerHandler));
responsesRouter.post('/:id/submit', asyncHandler(submitResponseHandler));
responsesRouter.get('/:id/result', asyncHandler(getResultHandler));
