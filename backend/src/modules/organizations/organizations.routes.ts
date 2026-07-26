import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  getBenchmarkingSummaryHandler,
  getOrganizationQuestionnaireSummaryHandler,
} from '../insights/insights.controller';
import { createOrganizationHandler, listOrganizationsHandler } from './organizations.controller';

// Per-route middleware (not router.use(...)) deliberately — a blanket router-level
// requireRole('ADMIN') would intercept every sub-path under /organizations, including
// routes with different role requirements like questionnaire-summary below.
export const organizationsRouter = Router();

organizationsRouter.get('/', authenticate, requireRole('ADMIN'), asyncHandler(listOrganizationsHandler));
organizationsRouter.post('/', authenticate, requireRole('ADMIN'), asyncHandler(createOrganizationHandler));

// Registered before /:orgId/questionnaire-summary: distinct single-segment path, but kept
// first for readability (Express matches by full pattern shape, not just prefix, so
// order between these two specific routes doesn't actually matter).
organizationsRouter.get(
  '/benchmarking',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(getBenchmarkingSummaryHandler),
);

organizationsRouter.get(
  '/:orgId/questionnaire-summary',
  authenticate,
  requireRole('EXECUTIVE', 'ADMIN'),
  asyncHandler(getOrganizationQuestionnaireSummaryHandler),
);
