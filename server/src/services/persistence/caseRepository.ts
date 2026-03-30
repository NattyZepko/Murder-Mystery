import { prisma } from '../../db/prismaClient';
import type { MurderCaseRecord } from '../../types/caseGeneration';

// Temporary editor-compatibility shim: some TS server sessions cache stale Prisma model metadata.
const db = prisma as any;

function mapCaseRecordFromDb(dbCase: {
	id: string;
	theme: string;
	storySummary: string;
	locationName: string;
	victimName: string;
	victimBodyFoundRoom: string;
	victimTimeOfDeath: string;
	victimMurderWound: string;
	status: 'idle' | 'generating' | 'active' | 'solved' | 'failed';
	startedAt: Date;
	solvedAt: Date | null;
	finalOutcome: string | null;
	generationProgress: number;
	generationStepLabel: string;
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
		weapon: {
			name: string;
		};
	}>;
	guessCooldown: {
		lockedUntil: Date | null;
	} | null;
	suspectRelationships: Array<{
		suspect: { name: string };
		relatedSuspect: { name: string };
		relationshipDescription: string;
	}>;
}): MurderCaseRecord {
	const suspectNameById = new Map(
		dbCase.suspects.map((suspect) => [suspect.id, suspect.name]),
	);

	return {
		id: dbCase.id,
		theme: dbCase.theme,
		storySummary: dbCase.storySummary,
		locationName: dbCase.locationName,
		status: dbCase.status,
		startedAt: dbCase.startedAt.toISOString(),
		solvedAt: dbCase.solvedAt ? dbCase.solvedAt.toISOString() : null,
		finalOutcome: dbCase.finalOutcome,
		generationProgress: dbCase.generationProgress,
		generationStepLabel: dbCase.generationStepLabel,
		victim: {
			name: dbCase.victimName,
			bodyFoundRoom: dbCase.victimBodyFoundRoom,
			timeOfDeath: dbCase.victimTimeOfDeath,
			murderWound: dbCase.victimMurderWound,
		},
		weapons: dbCase.weapons.map((weapon) => ({
			id: weapon.id,
			name: weapon.name,
			belongsToSuspectName:
				(weapon.belongsToSuspectId &&
					suspectNameById.get(weapon.belongsToSuspectId)) ||
				'Unknown',
			seenBySuspectNames: weapon.seenBySuspectNames,
			isMurderWeapon: weapon.isMurderWeapon,
		})),
		suspects: dbCase.suspects,
		suspectRelationships: dbCase.suspectRelationships.map((entry) => ({
			suspectName: entry.suspect.name,
			relatedSuspectName: entry.relatedSuspect.name,
			relationshipDescription: entry.relationshipDescription,
		})),
		chats: dbCase.chats.map((entry) => ({
			id: entry.id,
			suspectId: entry.suspectId,
			role: entry.role,
			content: entry.content,
			createdAt: entry.createdAt.toISOString(),
		})),
		discoveredWeapons: dbCase.discoveredWeapons.map((entry) => ({
			weaponId: entry.weaponId,
			weaponName: entry.weapon.name,
			discoveredAt: entry.discoveredAt.toISOString(),
			discoveredBySuspectId: entry.discoveredBySuspectId,
		})),
		guessCooldownUntil: dbCase.guessCooldown?.lockedUntil
			? dbCase.guessCooldown.lockedUntil.toISOString()
			: null,
	};
}

export async function createCaseSkeleton(input: {
	caseId: string;
	startedAt: string;
	generationStepLabel: string;
}): Promise<MurderCaseRecord> {
	const dbCase = await db.murderCase.create({
		data: {
			id: input.caseId,
			theme: 'Generating case...',
			storySummary: 'Building setting, suspects, and clues.',
			locationName: 'Pending',
			victimName: '',
			victimBodyFoundRoom: '',
			victimTimeOfDeath: '',
			victimMurderWound: '',
			status: 'generating',
			startedAt: new Date(input.startedAt),
			generationProgress: 0,
			generationStepLabel: input.generationStepLabel,
		},
		include: {
			suspects: true,
			weapons: true,
			chats: true,
			discoveredWeapons: {
				include: {
					weapon: {
						select: {
							name: true,
						},
					},
				},
			},
			guessCooldown: true,
			suspectRelationships: {
				include: {
					suspect: { select: { name: true } },
					relatedSuspect: { select: { name: true } },
				},
			},
		},
	});

	return mapCaseRecordFromDb(dbCase);
}

export async function updateCaseGenerationProgress(input: {
	caseId: string;
	generationProgress: number;
	generationStepLabel: string;
}) {
	await db.murderCase.update({
		where: { id: input.caseId },
		data: {
			generationProgress: input.generationProgress,
			generationStepLabel: input.generationStepLabel,
			status: 'generating',
		},
	});
}

export async function markCaseGenerationFailed(input: {
	caseId: string;
	errorMessage: string;
}) {
	await db.murderCase.update({
		where: { id: input.caseId },
		data: {
			status: 'failed',
			generationStepLabel: input.errorMessage,
		},
	});
}

export async function saveGeneratedCase(
	caseRecord: MurderCaseRecord,
): Promise<void> {
	const suspectIdByName = new Map(
		caseRecord.suspects.map((suspect) => [suspect.name, suspect.id]),
	);

	const relationshipRows = caseRecord.suspectRelationships
		.map((entry) => {
			const suspectId = suspectIdByName.get(entry.suspectName);
			const relatedSuspectId = suspectIdByName.get(entry.relatedSuspectName);

			if (!suspectId || !relatedSuspectId) {
				return null;
			}

			return {
				caseId: caseRecord.id,
				suspectId,
				relatedSuspectId,
				relationshipDescription: entry.relationshipDescription,
			};
		})
		.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

	await db.$transaction([
		db.suspectRelationship.deleteMany({
			where: { caseId: caseRecord.id },
		}),
		db.chatMessage.deleteMany({ where: { caseId: caseRecord.id } }),
		db.weapon.deleteMany({ where: { caseId: caseRecord.id } }),
		db.suspect.deleteMany({ where: { caseId: caseRecord.id } }),
		db.murderCase.update({
			where: { id: caseRecord.id },
			data: {
				theme: caseRecord.theme,
				storySummary: caseRecord.storySummary,
				locationName: caseRecord.locationName,
				victimName: caseRecord.victim.name,
				victimBodyFoundRoom: caseRecord.victim.bodyFoundRoom,
				victimTimeOfDeath: caseRecord.victim.timeOfDeath,
				victimMurderWound: caseRecord.victim.murderWound,
				status: caseRecord.status,
				generationProgress: caseRecord.generationProgress,
				generationStepLabel: caseRecord.generationStepLabel,
			},
		}),
		db.suspect.createMany({
			data: caseRecord.suspects.map((suspect) => ({
				id: suspect.id,
				caseId: caseRecord.id,
				name: suspect.name,
				isGuilty: suspect.isGuilty,
				relationshipToVictim: suspect.relationshipToVictim,
				gender: suspect.gender,
				quirkBehavior: suspect.quirkBehavior,
				motive: suspect.motive,
				alibi: suspect.alibi,
				privateBackstory: suspect.privateBackstory,
				publicDemeanor: suspect.publicDemeanor,
				knowsMotiveOfSuspectName: suspect.knowsMotiveOfSuspectName,
			})),
		}),
		db.weapon.createMany({
			data: caseRecord.weapons.map((weapon) => ({
				id: weapon.id,
				caseId: caseRecord.id,
				name: weapon.name,
				belongsToSuspectId:
					suspectIdByName.get(weapon.belongsToSuspectName) ?? null,
				seenBySuspectNames: weapon.seenBySuspectNames,
				isMurderWeapon: weapon.isMurderWeapon,
			})),
		}),
		db.suspectRelationship.createMany({
			data: relationshipRows,
		}),
	]);
}

export async function findCaseById(
	caseId: string,
): Promise<MurderCaseRecord | null> {
	const dbCase = await db.murderCase.findUnique({
		where: { id: caseId },
		include: {
			suspects: true,
			weapons: true,
			chats: {
				orderBy: {
					createdAt: 'asc',
				},
			},
			discoveredWeapons: {
				include: {
					weapon: {
						select: {
							name: true,
						},
					},
				},
				orderBy: {
					discoveredAt: 'asc',
				},
			},
			guessCooldown: true,
			suspectRelationships: {
				include: {
					suspect: { select: { name: true } },
					relatedSuspect: { select: { name: true } },
				},
			},
		},
	});

	if (!dbCase) {
		return null;
	}

	return mapCaseRecordFromDb(dbCase);
}

export async function listRecentThemes(limit = 8): Promise<string[]> {
	const rows = await db.murderCase.findMany({
		where: {
			status: {
				in: ['active', 'solved'],
			},
		},
		orderBy: {
			startedAt: 'desc',
		},
		take: limit,
		select: {
			theme: true,
		},
	});

	return rows
		.map((entry: { theme: string }) => entry.theme.trim())
		.filter((theme: string) => theme.length > 0);
}
