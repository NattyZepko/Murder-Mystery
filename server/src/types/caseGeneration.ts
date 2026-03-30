export type MurderCaseStatus =
	| 'idle'
	| 'generating'
	| 'active'
	| 'solved'
	| 'failed';

export type VictimRecord = {
	name: string;
	bodyFoundRoom: string;
	timeOfDeath: string;
	murderWound: string;
};

export type WeaponRecord = {
	id: string;
	name: string;
	belongsToSuspectName: string;
	seenBySuspectNames: string[];
	isMurderWeapon: boolean;
};

export type SuspectRecord = {
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
};

export type SuspectRelationshipRecord = {
	suspectName: string;
	relatedSuspectName: string;
	relationshipDescription: string;
};

export type ChatMessageRecord = {
	id: string;
	suspectId: string;
	role: 'user' | 'suspect' | 'system';
	content: string;
	createdAt: string;
};

export type DiscoveredWeaponRecord = {
	weaponId: string;
	weaponName: string;
	discoveredAt: string;
	discoveredBySuspectId: string | null;
};

export type MurderCaseRecord = {
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
	victim: VictimRecord;
	weapons: WeaponRecord[];
	suspects: SuspectRecord[];
	suspectRelationships: SuspectRelationshipRecord[];
	chats: ChatMessageRecord[];
	discoveredWeapons: DiscoveredWeaponRecord[];
	guessCooldownUntil: string | null;
};
