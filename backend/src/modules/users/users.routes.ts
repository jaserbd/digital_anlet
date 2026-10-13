import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  addMembershipHandler,
  createUserHandler,
  deleteUserHandler,
  listUsersHandler,
  removeMembershipHandler,
  setTemporaryPasswordHandler,
  updateMembershipHandler,
  updateUserHandler,
} from './users.controller';

export const usersRouter = Router();

// Project Admins manage members of their own organization (PROJECTS_PLAN.md — scoped in the
// handlers); granting Admin and deleting accounts stay Application-Admin-only.
usersRouter.use(authenticate, requireRole('ADMIN', 'PROJECT_ADMIN'));
usersRouter.get('/', asyncHandler(listUsersHandler));
usersRouter.post('/', asyncHandler(createUserHandler));
usersRouter.patch('/:id', requireRole('ADMIN'), asyncHandler(updateUserHandler));
usersRouter.delete('/:id', requireRole('ADMIN'), asyncHandler(deleteUserHandler));
// Organization memberships (MULTI_ORG_PLAN.md) and admin-generated temporary passwords.
usersRouter.post('/:id/memberships', asyncHandler(addMembershipHandler));
usersRouter.patch('/:id/memberships/:membershipId', asyncHandler(updateMembershipHandler));
usersRouter.delete('/:id/memberships/:membershipId', asyncHandler(removeMembershipHandler));
usersRouter.post('/:id/temporary-password', asyncHandler(setTemporaryPasswordHandler));
