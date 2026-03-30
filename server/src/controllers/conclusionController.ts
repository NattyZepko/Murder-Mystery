import type { Request, Response } from 'express';

import { ConclusionError } from '../services/conclusion/conclusionErrors';
import { submitConclusion } from '../services/conclusion/conclusionService';

export async function submitConclusionController(req: Request, res: Response) {
	try {
		const result = await submitConclusion({
			caseId: req.params.caseId,
			guessedSuspectId:
				typeof req.body?.suspectId === 'string' ? req.body.suspectId : '',
			guessedWeaponId:
				typeof req.body?.weaponId === 'string' ? req.body.weaponId : '',
		});

		return res.status(200).json(result);
	} catch (error) {
		if (error instanceof ConclusionError) {
			return res.status(error.statusCode).json({ error: error.message });
		}

		return res.status(500).json({ error: 'Unexpected server error' });
	}
}

export async function getConclusionCooldownController(
	req: Request,
	res: Response,
) {
	try {
		const result = await submitConclusion({
			caseId: req.params.caseId,
			guessedSuspectId: '',
			guessedWeaponId: '',
			mode: 'cooldownOnly',
		});

		return res.status(200).json(result);
	} catch (error) {
		if (error instanceof ConclusionError) {
			return res.status(error.statusCode).json({ error: error.message });
		}

		return res.status(500).json({ error: 'Unexpected server error' });
	}
}
