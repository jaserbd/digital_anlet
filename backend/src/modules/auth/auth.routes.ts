import { Router } from 'express';
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

authRouter.post('/login', asyncHandler(loginHandler));
authRouter.post('/logout', logoutHandler);
authRouter.post('/forgot-password', asyncHandler(forgotPasswordHandler));
authRouter.post('/reset-password', asyncHandler(resetPasswordHandler));
authRouter.get('/me', authenticate, asyncHandler(meHandler));
authRouter.put('/profile', authenticate, asyncHandler(updateProfileHandler));
authRouter.post('/context', authenticate, asyncHandler(switchContextHandler));
authRouter.put('/change-password', authenticate, asyncHandler(changePasswordHandler));
