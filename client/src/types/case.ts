export type MurderCase = {
	id: string;
	theme: string;
	storySummary: string;
	locationName: string;
	status: 'idle' | 'generating' | 'active' | 'solved' | 'failed';
	startedAt: string;
	solvedAt: string | null;
	finalOutcome: string | null;
	generationProgress: number;
	generationStepLabel: string;
	victim: {
		name: string;
		bodyFoundRoom: string;
		timeOfDeath: string;
		murderWound: string;
	};
	weapons: Array<{
		id: string;
		name: string;
		belongsToSuspectName: string;
		seenBySuspectNames: string[];
		isMurderWeapon: boolean;
	}>;
	suspects: Array<{
		id: string;
		name: string;
		isGuilty: boolean;
		relationshipToVictim: string;
		gender: string;
		quirkBehavior: string | null;
		motive: string;
		alibi: string;
		privateBackstory: string;
		publicDemeanor: string;
		knowsMotiveOfSuspectName: string;
	}>;
	suspectRelationships: Array<{
		suspectName: string;
		relatedSuspectName: string;
		relationshipDescription: string;
	}>;
	chats: Array<{
		id: string;
		suspectId: string;
		role: 'user' | 'suspect' | 'system';
		content: string;
		createdAt: string;
	}>;
	discoveredWeapons: Array<{
		weaponId: string;
		weaponName: string;
		discoveredAt: string;
		discoveredBySuspectId: string | null;
	}>;
	guessCooldownUntil: string | null;
};

export type SuspectChatResponse = {
	reply: string;
	discoveredWeapons: Array<{
		weaponId: string;
		weaponName: string;
	}>;
};

export type GuessResponse = {
	isCorrect: boolean;
	lockedUntil: string | null;
	lockedRemainingSeconds: number;
	solvedAt: string | null;
	solution?: {
		suspectId: string;
		suspectName: string;
		weaponId: string;
		weaponName: string;
	};
};

export type CooldownResponse = {
	lockedUntil: string | null;
	lockedRemainingSeconds: number;
};
