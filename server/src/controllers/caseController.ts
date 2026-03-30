import type { Request, Response } from 'express';

import { CaseGenerationFailedError } from '../services/caseGeneration/caseGenerationErrors';
import {
	createCase,
	getCaseById,
} from '../services/caseGeneration/caseGenerationService';

export async function createCaseController(_req: Request, res: Response) {
	try {
		const createdCase = await createCase();
		res.status(202).json(createdCase);
	} catch (error) {
		if (error instanceof CaseGenerationFailedError) {
			return res.status(422).json({
				error: 'Case generation failed. Please retry.',
				details: error.message,
			});
		}

		return res.status(500).json({ error: 'Unexpected server error' });
	}
}

export async function getCaseController(req: Request, res: Response) {
	const existingCase = await getCaseById(req.params.caseId);

	if (!existingCase) {
		return res.status(404).json({ error: 'Case not found' });
	}

	return res.json(existingCase);
}
