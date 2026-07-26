import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { loginHandler, logoutHandler, meHandler } from './auth.controller';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(loginHandler));
authRouter.post('/logout', logoutHandler);
authRouter.get('/me', authenticate, meHandler);
