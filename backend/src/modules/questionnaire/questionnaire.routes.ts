import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  getQuestionnaireHandler,
  listQuestionnairesHandler,
  setAcceptingResponsesHandler,
} from './questionnaire.controller';

export const questionnaireRouter = Router();

// Blanket authenticate is fine here — every route below is readable by any authenticated
// role. The one write route (PATCH .../accepting) adds its own requireRole('ADMIN')
// per-route rather than promoting the blanket middleware, per the router-mounting gotcha
// (CLAUDE.md) — a router-level requireRole would lock the GET routes to Admin too.
questionnaireRouter.use(authenticate);
questionnaireRouter.get('/', asyncHandler(listQuestionnairesHandler));
questionnaireRouter.get('/:code', asyncHandler(getQuestionnaireHandler));
questionnaireRouter.patch(
  '/:code/accepting',
  requireRole('ADMIN'),
  asyncHandler(setAcceptingResponsesHandler),
);
