export const murderCaseStatusValues = [
	'idle',
	'generating',
	'active',
	'solved',
	'failed',
] as const;

export type MurderCaseStatus = (typeof murderCaseStatusValues)[number];

export type MurderCase = {
	id: string;
	theme: string;
	storySummary: string;
	locationName: string;
	status: MurderCaseStatus;
	startedAt: string;
	solvedAt: string | null;
	finalOutcome: string | null;
	generationProgress: number;
	generationStepLabel: string;
};
