import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { createOpCoHandler, deleteOpCoHandler, listOpCosHandler } from './opcos.controller';

export const opCosRouter = Router();

opCosRouter.get('/', authenticate, asyncHandler(listOpCosHandler));
opCosRouter.post('/', authenticate, requireRole('ADMIN'), asyncHandler(createOpCoHandler));
opCosRouter.delete('/:id', authenticate, requireRole('ADMIN'), asyncHandler(deleteOpCoHandler));
