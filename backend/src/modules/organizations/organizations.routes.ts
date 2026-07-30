import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  getAnswerDrilldownHandler,
  getBenchmarkingSummaryHandler,
  getCognitiveActivitySummaryHandler,
  getCombinedBenchmarkingSummaryHandler,
  getCombinedOpCoBenchmarkingSummaryHandler,
  getCrossOrgCommentCollectionHandler,
  getOpCoBenchmarkingSummaryHandler,
  getOrganizationQuestionnaireSummaryHandler,
} from '../insights/insights.controller';
import { createOrganizationHandler, deleteOrganizationHandler, listOrganizationsHandler } from './organizations.controller';

// Per-route middleware (not router.use(...)) deliberately — a blanket router-level
// requireRole('ADMIN') would intercept every sub-path under /organizations, including
// routes with different role requirements like questionnaire-summary below.
export const organizationsRouter = Router();

organizationsRouter.get('/', authenticate, requireRole('ADMIN'), asyncHandler(listOrganizationsHandler));
organizationsRouter.post('/', authenticate, requireRole('ADMIN'), asyncHandler(createOrganizationHandler));
organizationsRouter.delete('/:id', authenticate, requireRole('ADMIN'), asyncHandler(deleteOrganizationHandler));

// Registered before /:orgId/questionnaire-summary: distinct single-segment path, but kept
// first for readability (Express matches by full pattern shape, not just prefix, so
// order between these two specific routes doesn't actually matter).
organizationsRouter.get(
  '/benchmarking',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(getBenchmarkingSummaryHandler),
);

// FORTH_REVIEW.md items 5/6: the combined (Core FM + Stability) analogue of /benchmarking
// above — a distinct literal path, so registration order relative to /benchmarking doesn't
// matter (same note as that route's own comment).
organizationsRouter.get(
  '/benchmarking/combined',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(getCombinedBenchmarkingSummaryHandler),
);

// ADMIN.md item 3 — cross-org Comment Collection, another distinct literal path alongside
// /benchmarking above.
organizationsRouter.get(
  '/comment-collection',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(getCrossOrgCommentCollectionHandler),
);

organizationsRouter.get(
  '/:orgId/questionnaire-summary',
  authenticate,
  requireRole('EXECUTIVE', 'ADMIN'),
  asyncHandler(getOrganizationQuestionnaireSummaryHandler),
);

organizationsRouter.get(
  '/:orgId/opco-benchmarking',
  authenticate,
  requireRole('EXECUTIVE', 'ADMIN'),
  asyncHandler(getOpCoBenchmarkingSummaryHandler),
);

organizationsRouter.get(
  '/:orgId/opco-benchmarking/combined',
  authenticate,
  requireRole('EXECUTIVE', 'ADMIN'),
  asyncHandler(getCombinedOpCoBenchmarkingSummaryHandler),
);

organizationsRouter.get(
  '/:orgId/answer-drilldown',
  authenticate,
  requireRole('EXECUTIVE', 'ADMIN'),
  asyncHandler(getAnswerDrilldownHandler),
);

// ADMIN_2.md item 1 — the IAADE/Cognitive-Activity spider chart's aggregate data source.
organizationsRouter.get(
  '/:orgId/cognitive-activity-summary',
  authenticate,
  requireRole('EXECUTIVE', 'ADMIN'),
  asyncHandler(getCognitiveActivitySummaryHandler),
);
