import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  createProjectHandler,
  deleteProjectHandler,
  importProjectHandler,
  listProjectsHandler,
  updateProjectHandler,
} from './projects.controller';

// Application Admins only (PROJECTS_PLAN.md) — Project Admins manage members inside their
// project through /users, /opcos and the accepting toggle instead.
export const projectsRouter = Router();

projectsRouter.use(authenticate, requireRole('ADMIN'));
projectsRouter.get('/', asyncHandler(listProjectsHandler));
projectsRouter.post('/', asyncHandler(createProjectHandler));
// Literal path before /:id routes (see CLAUDE.md's route-ordering gotcha).
projectsRouter.post('/import', asyncHandler(importProjectHandler));
projectsRouter.patch('/:id', asyncHandler(updateProjectHandler));
projectsRouter.delete('/:id', asyncHandler(deleteProjectHandler));
