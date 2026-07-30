import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  bulkCreateUsersHandler,
  createUserHandler,
  deleteUserHandler,
  listUsersHandler,
  updateUserHandler,
} from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate, requireRole('ADMIN'));
usersRouter.get('/', asyncHandler(listUsersHandler));
usersRouter.post('/', asyncHandler(createUserHandler));
usersRouter.post('/bulk', asyncHandler(bulkCreateUsersHandler));
usersRouter.patch('/:id', asyncHandler(updateUserHandler));
usersRouter.delete('/:id', asyncHandler(deleteUserHandler));
