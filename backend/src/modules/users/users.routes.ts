import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { createUserHandler } from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate, requireRole('ADMIN'));
usersRouter.post('/', asyncHandler(createUserHandler));
