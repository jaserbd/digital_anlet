import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { createOpCoHandler, deleteOpCoHandler, listOpCosHandler } from './opcos.controller';

export const opCosRouter = Router();

opCosRouter.get('/', authenticate, asyncHandler(listOpCosHandler));
// Project Admins manage their own organization's NatCos (PROJECTS_PLAN.md) — checked in the handlers.
opCosRouter.post('/', authenticate, requireRole('ADMIN', 'PROJECT_ADMIN'), asyncHandler(createOpCoHandler));
opCosRouter.delete('/:id', authenticate, requireRole('ADMIN', 'PROJECT_ADMIN'), asyncHandler(deleteOpCoHandler));
