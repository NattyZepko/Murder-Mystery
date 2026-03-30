import { prisma } from '../../db/prismaClient';

const db = prisma as any;

type CaseInteractionRecord = {
	id: string;
	status: 'idle' | 'generating' | 'active' | 'solved' | 'failed';
	startedAt: Date;
	solvedAt: Date | null;
	theme: string;
	storySummary: string;
	locationName: string;
	victimName: string;
	victimBodyFoundRoom: string;
	victimTimeOfDeath: string;
	victimMurderWound: string;
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
	weapons: Array<{
		id: string;
		name: string;
		belongsToSuspectId: string | null;
		seenBySuspectNames: string[];
		isMurderWeapon: boolean;
	}>;
	chats: Array<{
		id: string;
		suspectId: string;
		role: 'user' | 'suspect' | 'system';
		content: string;
		createdAt: Date;
	}>;
	discoveredWeapons: Array<{
		weaponId: string;
		discoveredAt: Date;
		discoveredBySuspectId: string | null;
		weapon: { id: string; name: string; belongsToSuspectId: string | null };
	}>;
	guessCooldown: {
		lockedUntil: Date | null;
	} | null;
};

export async function findCaseInteractionById(
	caseId: string,
): Promise<CaseInteractionRecord | null> {
	return db.murderCase.findUnique({
		where: { id: caseId },
		include: {
			suspects: true,
			weapons: true,
			chats: {
				orderBy: { createdAt: 'asc' },
			},
			discoveredWeapons: {
				include: {
					weapon: {
						select: {
							id: true,
							name: true,
							belongsToSuspectId: true,
						},
					},
				},
				orderBy: { discoveredAt: 'asc' },
			},
			guessCooldown: true,
		},
	});
}

export async function saveSuspectChatExchange(input: {
	caseId: string;
	suspectId: string;
	userMessage: string;
	suspectReply: string;
}) {
	await db.chatMessage.createMany({
		data: [
			{
				caseId: input.caseId,
				suspectId: input.suspectId,
				role: 'user',
				content: input.userMessage,
			},
			{
				caseId: input.caseId,
				suspectId: input.suspectId,
				role: 'suspect',
				content: input.suspectReply,
			},
		],
	});
}

export async function addDiscoveredWeapons(input: {
	caseId: string;
	weaponIds: string[];
	discoveredBySuspectId: string;
}) {
	for (const weaponId of input.weaponIds) {
		await db.discoveredWeapon.upsert({
			where: {
				caseId_weaponId: {
					caseId: input.caseId,
					weaponId,
				},
			},
			update: {},
			create: {
				caseId: input.caseId,
				weaponId,
				discoveredBySuspectId: input.discoveredBySuspectId,
			},
		});
	}
}

export async function createGuessAttempt(input: {
	caseId: string;
	guessedSuspectId: string;
	guessedWeaponId: string;
	isCorrect: boolean;
}) {
	await db.guessAttempt.create({
		data: input,
	});
}

export async function setGuessCooldown(input: {
	caseId: string;
	lockedUntil: Date | null;
}) {
	await db.guessCooldown.upsert({
		where: { caseId: input.caseId },
		update: { lockedUntil: input.lockedUntil },
		create: {
			caseId: input.caseId,
			lockedUntil: input.lockedUntil,
		},
	});
}

export async function markCaseSolved(input: {
	caseId: string;
	solvedAt: Date;
	finalOutcome: string;
}) {
	await db.murderCase.update({
		where: { id: input.caseId },
		data: {
			status: 'solved',
			solvedAt: input.solvedAt,
			finalOutcome: input.finalOutcome,
		},
	});
}
