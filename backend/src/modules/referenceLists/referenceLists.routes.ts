import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import {
  createReferenceListEntryHandler,
  deleteReferenceListEntryHandler,
  listReferenceListEntriesHandler,
} from './referenceLists.controller';

export const referenceListsRouter = Router();

referenceListsRouter.get('/:category', authenticate, asyncHandler(listReferenceListEntriesHandler));
// Project Admins: their own organization's NATCO_NAME entries only (checked in the handlers).
referenceListsRouter.post(
  '/:category',
  authenticate,
  requireRole('ADMIN', 'PROJECT_ADMIN'),
  asyncHandler(createReferenceListEntryHandler),
);
referenceListsRouter.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'PROJECT_ADMIN'),
  asyncHandler(deleteReferenceListEntryHandler),
);
