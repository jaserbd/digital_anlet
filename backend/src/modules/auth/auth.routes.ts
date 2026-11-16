import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import {
  changePasswordHandler,
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  resetPasswordHandler,
  switchContextHandler,
  updateProfileHandler,
} from './auth.controller';

export const authRouter = Router();

// Per client address, per instance (ONBOARDING_SECURITY_PLAN.md Phase 6) — slows guessing and
// flooding from one place; the per-account pause in auth.service.ts login holds across
// instances. Off in tests, which sign in repeatedly from one address.
function limiter(windowMinutes: number, limit: number, options: { failedOnly?: boolean } = {}) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: options.failedOnly ?? false,
    skip: () => env.NODE_ENV === 'test',
    message: { error: 'Too many attempts from this network — please wait a few minutes and try again' },
  });
}

authRouter.post('/login', limiter(15, 30, { failedOnly: true }), asyncHandler(loginHandler));
authRouter.post('/logout', logoutHandler);
// Each request can send an email, so this one is tighter.
authRouter.post('/forgot-password', limiter(60, 10), asyncHandler(forgotPasswordHandler));
authRouter.post('/reset-password', limiter(15, 20, { failedOnly: true }), asyncHandler(resetPasswordHandler));
authRouter.get('/me', authenticate, asyncHandler(meHandler));
authRouter.put('/profile', authenticate, asyncHandler(updateProfileHandler));
authRouter.post('/context', authenticate, asyncHandler(switchContextHandler));
authRouter.put('/change-password', authenticate, asyncHandler(changePasswordHandler));
