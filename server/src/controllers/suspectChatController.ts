import type { Request, Response } from 'express';

import { SuspectChatError } from '../services/suspectChat/suspectChatErrors';
import { sendMessageToSuspect } from '../services/suspectChat/suspectChatService';

export async function suspectChatController(req: Request, res: Response) {
	try {
		const result = await sendMessageToSuspect({
			caseId: req.params.caseId,
			suspectId: req.params.suspectId,
			message:
				typeof req.body?.message === 'string' ? req.body.message.trim() : '',
		});

		return res.status(200).json(result);
	} catch (error) {
		if (error instanceof SuspectChatError) {
			return res.status(error.statusCode).json({ error: error.message });
		}

		console.error('[suspect-chat] Unexpected error:', error);
		return res.status(500).json({ error: 'Unexpected server error' });
	}
}
