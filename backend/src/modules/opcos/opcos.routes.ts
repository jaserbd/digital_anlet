import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { createOpCoHandler, listOpCosHandler } from './opcos.controller';

export const opCosRouter = Router();

opCosRouter.get('/', authenticate, asyncHandler(listOpCosHandler));
opCosRouter.post('/', authenticate, requireRole('ADMIN'), asyncHandler(createOpCoHandler));
