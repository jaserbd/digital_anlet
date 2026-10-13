import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  addProjectAdminHandler,
  createProjectHandler,
  deleteProjectHandler,
  importProjectHandler,
  listProjectAdminCandidatesHandler,
  listProjectsHandler,
  removeProjectAdminHandler,
  updateProjectHandler,
} from './projects.controller';

// Application Admins only (PROJECTS_PLAN.md) — Project Admins manage members inside their
// project through /users, /opcos and the accepting toggle instead.
export const projectsRouter = Router();

projectsRouter.use(authenticate, requireRole('ADMIN'));
projectsRouter.get('/', asyncHandler(listProjectsHandler));
projectsRouter.post('/', asyncHandler(createProjectHandler));
// Literal paths before /:id routes (see CLAUDE.md's route-ordering gotcha).
projectsRouter.post('/import', asyncHandler(importProjectHandler));
projectsRouter.get('/project-admin-candidates', asyncHandler(listProjectAdminCandidatesHandler));
projectsRouter.patch('/:id', asyncHandler(updateProjectHandler));
projectsRouter.delete('/:id', asyncHandler(deleteProjectHandler));
// Project Admins are added and removed per project (PROJECTS_V2_PLAN.md).
projectsRouter.post('/:id/project-admins', asyncHandler(addProjectAdminHandler));
projectsRouter.delete('/:id/project-admins/:userId', asyncHandler(removeProjectAdminHandler));
