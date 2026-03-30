import { Router } from 'express';

import {
	createCaseController,
	getCaseController,
} from '../controllers/caseController';
import {
	getConclusionCooldownController,
	submitConclusionController,
} from '../controllers/conclusionController';
import { suspectChatController } from '../controllers/suspectChatController';

export const caseRouter = Router();

caseRouter.post('/generate', createCaseController);
caseRouter.post('/', createCaseController);
caseRouter.get('/:caseId', getCaseController);
caseRouter.post('/:caseId/suspects/:suspectId/chat', suspectChatController);
caseRouter.post('/:caseId/guess', submitConclusionController);
caseRouter.get('/:caseId/cooldown', getConclusionCooldownController);
