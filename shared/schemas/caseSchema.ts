import { z } from 'zod';

import { murderCaseStatusValues } from '../types/case';

export const murderCaseSchema = z.object({
	id: z.string().uuid(),
	theme: z.string(),
	storySummary: z.string(),
	locationName: z.string(),
	status: z.enum(murderCaseStatusValues),
	startedAt: z.string(),
	solvedAt: z.string().nullable(),
	finalOutcome: z.string().nullable(),
	generationProgress: z.number(),
	generationStepLabel: z.string(),
});
