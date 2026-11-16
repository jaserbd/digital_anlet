import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  mailStatusHandler,
  resetMailSettingsHandler,
  sendTestEmailHandler,
  updateMailSettingsHandler,
} from './mail.controller';

// Email delivery settings and test (ONBOARDING_SECURITY_PLAN.md Phases 2/2b) — Application Admins
// read; changing and testing is super-admin-only (checked in the handlers).
export const mailRouter = Router();

mailRouter.use(authenticate, requireRole('ADMIN'));
mailRouter.get('/status', asyncHandler(mailStatusHandler));
mailRouter.put('/settings', asyncHandler(updateMailSettingsHandler));
mailRouter.delete('/settings', asyncHandler(resetMailSettingsHandler));
mailRouter.post('/test', asyncHandler(sendTestEmailHandler));
