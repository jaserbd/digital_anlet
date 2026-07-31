import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { opCosRouter } from '../modules/opcos/opcos.routes';
import { organizationsRouter } from '../modules/organizations/organizations.routes';
import { questionnaireRouter } from '../modules/questionnaire/questionnaire.routes';
import { referenceListsRouter } from '../modules/referenceLists/referenceLists.routes';
import { responsesRouter } from '../modules/responses/responses.routes';
import { usersRouter } from '../modules/users/users.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/organizations', organizationsRouter);
apiRouter.use('/opcos', opCosRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/questionnaires', questionnaireRouter);
apiRouter.use('/responses', responsesRouter);
apiRouter.use('/reference-lists', referenceListsRouter);
