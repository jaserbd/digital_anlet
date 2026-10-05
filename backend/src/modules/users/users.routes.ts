import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  addMembershipHandler,
  bulkCreateUsersHandler,
  createUserHandler,
  deleteUserHandler,
  listUsersHandler,
  removeMembershipHandler,
  setTemporaryPasswordHandler,
  updateMembershipHandler,
  updateUserHandler,
} from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate, requireRole('ADMIN'));
usersRouter.get('/', asyncHandler(listUsersHandler));
usersRouter.post('/', asyncHandler(createUserHandler));
usersRouter.post('/bulk', asyncHandler(bulkCreateUsersHandler));
usersRouter.patch('/:id', asyncHandler(updateUserHandler));
usersRouter.delete('/:id', asyncHandler(deleteUserHandler));
// Organization memberships (MULTI_ORG_PLAN.md) and admin-generated temporary passwords.
usersRouter.post('/:id/memberships', asyncHandler(addMembershipHandler));
usersRouter.patch('/:id/memberships/:membershipId', asyncHandler(updateMembershipHandler));
usersRouter.delete('/:id/memberships/:membershipId', asyncHandler(removeMembershipHandler));
usersRouter.post('/:id/temporary-password', asyncHandler(setTemporaryPasswordHandler));
