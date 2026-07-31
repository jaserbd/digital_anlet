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
referenceListsRouter.post(
  '/:category',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(createReferenceListEntryHandler),
);
referenceListsRouter.delete('/:id', authenticate, requireRole('ADMIN'), asyncHandler(deleteReferenceListEntryHandler));
