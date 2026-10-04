import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import {
  createResponseHandler,
  deleteAnswerHandler,
  getCoreDomainSummaryHandler,
  getResponseHandler,
  getResultHandler,
  submitResponseHandler,
  upsertAnswerHandler,
  upsertCommentHandler,
  upsertKeiHandler,
} from './responses.controller';

export const responsesRouter = Router();

responsesRouter.use(authenticate);
responsesRouter.post('/', asyncHandler(createResponseHandler));
// Registered before /:id — otherwise the :id wildcard would swallow this literal path.
responsesRouter.get('/core-domain-summary', asyncHandler(getCoreDomainSummaryHandler));
responsesRouter.get('/:id', asyncHandler(getResponseHandler));
responsesRouter.put('/:id/answers', asyncHandler(upsertAnswerHandler));
responsesRouter.delete('/:id/answers/:questionId/:subScenarioId', asyncHandler(deleteAnswerHandler));
responsesRouter.put('/:id/comments', asyncHandler(upsertCommentHandler));
responsesRouter.put('/:id/kei', asyncHandler(upsertKeiHandler));
responsesRouter.post('/:id/submit', asyncHandler(submitResponseHandler));
responsesRouter.get('/:id/result', asyncHandler(getResultHandler));
