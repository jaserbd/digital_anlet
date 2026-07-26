import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { getQuestionnaireHandler } from './questionnaire.controller';

export const questionnaireRouter = Router();

questionnaireRouter.use(authenticate);
questionnaireRouter.get('/:code', asyncHandler(getQuestionnaireHandler));
