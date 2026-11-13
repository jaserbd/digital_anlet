import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  getMemberImportContextHandler,
  getProjectQuestionnairesHandler,
  importProjectMembersHandler,
  setProjectQuestionnairesHandler,
} from './projectMembers.controller';

// Project Admins only (PROJECT_ADMIN_IMPORT_PLAN.md). Mounted at its own prefix: /projects carries
// a blanket Application-Admin check (see CLAUDE.md's route-mounting gotcha).
export const projectMembersRouter = Router();

projectMembersRouter.use(authenticate, requireRole('PROJECT_ADMIN'));
projectMembersRouter.get('/context', asyncHandler(getMemberImportContextHandler));
projectMembersRouter.post('/import', asyncHandler(importProjectMembersHandler));
// The project's questionnaire selection (PROJECT_ADMIN_QUESTIONNAIRES_PLAN.md).
projectMembersRouter.get('/questionnaires', asyncHandler(getProjectQuestionnairesHandler));
projectMembersRouter.put('/questionnaires', asyncHandler(setProjectQuestionnairesHandler));
