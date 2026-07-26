import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { getOrganizationQuestionnaireSummaryHandler } from '../insights/insights.controller';
import { createOrganizationHandler, listOrganizationsHandler } from './organizations.controller';

// Per-route middleware (not router.use(...)) deliberately — a blanket router-level
// requireRole('ADMIN') would intercept every sub-path under /organizations, including
// routes with different role requirements like questionnaire-summary below.
export const organizationsRouter = Router();

organizationsRouter.get('/', authenticate, requireRole('ADMIN'), asyncHandler(listOrganizationsHandler));
organizationsRouter.post('/', authenticate, requireRole('ADMIN'), asyncHandler(createOrganizationHandler));

organizationsRouter.get(
  '/:orgId/questionnaire-summary',
  authenticate,
  requireRole('EXECUTIVE', 'ADMIN'),
  asyncHandler(getOrganizationQuestionnaireSummaryHandler),
);
