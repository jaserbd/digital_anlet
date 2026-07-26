import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { createOrganizationHandler, listOrganizationsHandler } from './organizations.controller';

export const organizationsRouter = Router();

organizationsRouter.use(authenticate, requireRole('ADMIN'));
organizationsRouter.get('/', asyncHandler(listOrganizationsHandler));
organizationsRouter.post('/', asyncHandler(createOrganizationHandler));
