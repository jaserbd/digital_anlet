import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { mailStatusHandler, sendTestEmailHandler } from './mail.controller';

// Email delivery settings and test (ONBOARDING_SECURITY_PLAN.md Phase 2) — Application Admins.
export const mailRouter = Router();

mailRouter.use(authenticate, requireRole('ADMIN'));
mailRouter.get('/status', mailStatusHandler);
mailRouter.post('/test', asyncHandler(sendTestEmailHandler));
