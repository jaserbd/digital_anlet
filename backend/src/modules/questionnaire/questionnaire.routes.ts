import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  getAcceptingResponsesHandler,
  getQuestionnaireHandler,
  listHvsEntriesHandler,
  listQuestionnairesHandler,
  setAcceptingResponsesHandler,
} from './questionnaire.controller';

export const questionnaireRouter = Router();

// Blanket authenticate is fine here — every route below is readable by any authenticated
// role. The two Admin-only routes (.../accepting GET+PATCH) add their own
// requireRole('ADMIN') per-route rather than promoting the blanket middleware, per the
// router-mounting gotcha (CLAUDE.md) — a router-level requireRole would lock the GET / and
// GET /:code routes to Admin too.
questionnaireRouter.use(authenticate);
questionnaireRouter.get('/', asyncHandler(listQuestionnairesHandler));
// Registered before GET /:code — a literal path after a wildcard :param route would
// otherwise be swallowed as if "hvs-entries" were a questionnaire code (same gotcha
// documented for responses.routes.ts's /core-domain-summary — see CLAUDE.md).
questionnaireRouter.get('/hvs-entries', asyncHandler(listHvsEntriesHandler));
questionnaireRouter.get('/:code', asyncHandler(getQuestionnaireHandler));
questionnaireRouter.get(
  '/:code/accepting',
  requireRole('ADMIN'),
  asyncHandler(getAcceptingResponsesHandler),
);
questionnaireRouter.patch(
  '/:code/accepting',
  requireRole('ADMIN'),
  asyncHandler(setAcceptingResponsesHandler),
);
