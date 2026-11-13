import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { getMemberImportContextHandler, importProjectMembersHandler } from './projectMembers.controller';

// Project Admins only (PROJECT_ADMIN_IMPORT_PLAN.md). Mounted at its own prefix: /projects carries
// a blanket Application-Admin check (see CLAUDE.md's route-mounting gotcha).
export const projectMembersRouter = Router();

projectMembersRouter.use(authenticate, requireRole('PROJECT_ADMIN'));
projectMembersRouter.get('/context', asyncHandler(getMemberImportContextHandler));
projectMembersRouter.post('/import', asyncHandler(importProjectMembersHandler));
