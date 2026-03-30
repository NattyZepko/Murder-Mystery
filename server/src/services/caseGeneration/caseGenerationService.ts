import { randomUUID } from 'node:crypto';

import type {
	MurderCaseRecord,
	SuspectRecord,
	WeaponRecord,
} from '../../types/caseGeneration';
import { GeminiProvider } from '../ai/adapters/geminiProvider';
import { generateStructuredWithRetry } from '../ai/adapters/generateStructuredWithRetry';
import {
	buildAlibiNetworkPrompt,
	buildCaseThemePrompt,
	buildRelationsPrompt,
	buildSuspectListPrompt,
	buildSuspectProfilePrompt,
	buildVictimPrompt,
	buildWeaponsPrompt,
} from '../ai/prompts/casePrompts';
import {
	stage1ThemeSchema,
	stage2VictimSchema,
	stage3WeaponsSchema,
	stage4SuspectsSchema,
	stage5WeaponRelationsSchema,
	stage6AlibiNetworkSchema,
	stage7ProfileSchema,
} from '../ai/validators/caseGenerationSchemas';
import {
	createCaseSkeleton,
	findCaseById,
	listRecentThemes,
	markCaseGenerationFailed,
	saveGeneratedCase,
	updateCaseGenerationProgress,
} from '../persistence/caseRepository';
import { CaseGenerationFailedError } from './caseGenerationErrors';
import {
	fallbackAlibiNetwork,
	fallbackProfile,
	fallbackSuspects,
	fallbackTheme,
	fallbackVictim,
	fallbackWeaponRelations,
	fallbackWeapons,
} from './fallbackCaseParts';

const aiProvider = new GeminiProvider();

const generationStages = [
	'Generating setting',
	'Defining victim',
	'Forging weapons',
	'Choosing suspects',
	'Mapping weapon visibility',
	'Building relationships and alibis',
	'Building suspect profiles',
	'Finalizing case',
] as const;

function timeoutMs() {
	return Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000);
}

function heavyStageTimeoutMs() {
	return Number(process.env.AI_HEAVY_STAGE_TIMEOUT_MS || 45000);
}

function maxAttempts() {
	return Number(process.env.AI_MAX_ATTEMPTS || 3);
}

function baseRetryDelayMs() {
	return Number(process.env.AI_RETRY_BASE_DELAY_MS || 600);
}

function stageProgress(stageIndex: number): number {
	return Math.round((stageIndex / (generationStages.length - 1)) * 100);
}

function logStageAttemptFailure(details: {
	attempt: number;
	stageLabel: string;
	errorMessage: string;
}) {
	console.warn(
		`[case-generation] ${details.stageLabel} attempt ${details.attempt} failed: ${details.errorMessage}`,
	);
}

function logStageRetryScheduled(details: {
	attempt: number;
	nextAttempt: number;
	stageLabel: string;
	delayMs: number;
	errorMessage: string;
}) {
	console.warn(
		`[case-generation] ${details.stageLabel} scheduling retry ${details.nextAttempt} after ${details.delayMs}ms (attempt ${details.attempt} failed: ${details.errorMessage})`,
	);
}

function logStageFallbackUsed(details: {
	stageLabel: string;
	maxAttempts: number;
	lastErrorMessage: string;
}) {
	console.warn(
		`[case-generation] ${details.stageLabel} exhausted ${details.maxAttempts} attempts, using deterministic fallback. Last error: ${details.lastErrorMessage}`,
	);
}

function validateFinalInvariants(caseRecord: MurderCaseRecord) {
	const guiltyCount = caseRecord.suspects.filter(
		(suspect) => suspect.isGuilty,
	).length;
	const murderWeaponCount = caseRecord.weapons.filter(
		(weapon) => weapon.isMurderWeapon,
	).length;

	if (guiltyCount !== 1) {
		throw new CaseGenerationFailedError(
			'Case must have exactly one guilty suspect',
		);
	}

	if (murderWeaponCount !== 1) {
		throw new CaseGenerationFailedError(
			'Case must have exactly one murder weapon',
		);
	}

	if (caseRecord.suspects.length < 5 || caseRecord.suspects.length > 7) {
		throw new CaseGenerationFailedError('Case must have 5 to 7 suspects');
	}

	if (caseRecord.weapons.length < 3 || caseRecord.weapons.length > 5) {
		throw new CaseGenerationFailedError('Case must have 3 to 5 weapons');
	}

	for (const suspect of caseRecord.suspects) {
		if (!suspect.motive.trim()) {
			throw new CaseGenerationFailedError(
				`Suspect ${suspect.name} is missing motive`,
			);
		}
	}

	const guiltySuspect = caseRecord.suspects.find((suspect) => suspect.isGuilty);
	const trueWeapon = caseRecord.weapons.find((weapon) => weapon.isMurderWeapon);

	if (!guiltySuspect || !trueWeapon) {
		throw new CaseGenerationFailedError(
			'Missing guilty suspect or murder weapon',
		);
	}

	if (!trueWeapon.seenBySuspectNames.includes(guiltySuspect.name)) {
		throw new CaseGenerationFailedError(
			'True murderer must have seen the true murder weapon',
		);
	}
}

async function buildSuspectProfiles(input: {
	suspects: Array<{ name: string; isGuilty: boolean }>;
	alibis: Array<{ suspectName: string; alibi: string }>;
	relationships: Array<{
		suspectName: string;
		relatedSuspectName: string;
		relationshipDescription: string;
	}>;
}): Promise<SuspectRecord[]> {
	const profiles: SuspectRecord[] = [];

	for (let index = 0; index < input.suspects.length; index += 1) {
		const suspect = input.suspects[index];
		const knownNames = input.suspects
			.filter((entry) => entry.name !== suspect.name)
			.map((entry) => entry.name);

		const hintLines = input.relationships
			.filter(
				(entry) =>
					entry.suspectName === suspect.name ||
					entry.relatedSuspectName === suspect.name,
			)
			.map((entry) => entry.relationshipDescription);

		const profile = await generateStructuredWithRetry({
			provider: aiProvider,
			schema: stage7ProfileSchema,
			prompt: buildSuspectProfilePrompt({
				suspectName: suspect.name,
				isGuilty: suspect.isGuilty,
				knownSuspectNames: knownNames,
				relationshipHints: hintLines,
			}),
			timeoutMs: heavyStageTimeoutMs(),
			maxAttempts: maxAttempts(),
			baseRetryDelayMs: baseRetryDelayMs(),
			stageLabel: `${generationStages[6]} (${suspect.name})`,
			onAttemptFailure: logStageAttemptFailure,
			onRetryScheduled: logStageRetryScheduled,
			onFallbackUsed: logStageFallbackUsed,
			fallback: () =>
				fallbackProfile({
					suspectName: suspect.name,
					isGuilty: suspect.isGuilty,
					knowsMotiveOfSuspectName:
						knownNames[0] ||
						input.suspects[(index + 1) % input.suspects.length].name,
				}),
		});

		const alibiEntry = input.alibis.find(
			(entry) => entry.suspectName === suspect.name,
		);

		profiles.push({
			id: randomUUID(),
			name: suspect.name,
			isGuilty: suspect.isGuilty,
			relationshipToVictim: profile.relationshipToVictim,
			gender: profile.gender,
			quirkBehavior: profile.quirkBehavior,
			motive: profile.motive,
			alibi: alibiEntry?.alibi || 'Could not provide a reliable alibi',
			privateBackstory: profile.privateBackstory,
			publicDemeanor: profile.publicDemeanor,
			knowsMotiveOfSuspectName: profile.knowsMotiveOfSuspectName,
		});
	}

	return profiles;
}

export async function createCase(): Promise<MurderCaseRecord> {
	const caseId = randomUUID();
	const startedAt = new Date().toISOString();

	const skeleton = await createCaseSkeleton({
		caseId,
		startedAt,
		generationStepLabel: generationStages[0],
	});

	void generateCaseInBackground({
		caseId,
		startedAt,
	});

	return skeleton;
}

async function generateCaseInBackground(input: {
	caseId: string;
	startedAt: string;
}) {
	try {
		const recentThemes = await listRecentThemes(8);

		await updateCaseGenerationProgress({
			caseId: input.caseId,
			generationProgress: stageProgress(0),
			generationStepLabel: generationStages[0],
		});

		const stage1 = await generateStructuredWithRetry({
			provider: aiProvider,
			schema: stage1ThemeSchema,
			prompt: buildCaseThemePrompt({ recentThemes }),
			timeoutMs: timeoutMs(),
			maxAttempts: maxAttempts(),
			baseRetryDelayMs: baseRetryDelayMs(),
			stageLabel: generationStages[0],
			onAttemptFailure: logStageAttemptFailure,
			onRetryScheduled: logStageRetryScheduled,
			onFallbackUsed: logStageFallbackUsed,
			fallback: () => fallbackTheme({ recentThemes }),
		});

		await updateCaseGenerationProgress({
			caseId: input.caseId,
			generationProgress: stageProgress(1),
			generationStepLabel: generationStages[1],
		});

		const stage2 = await generateStructuredWithRetry({
			provider: aiProvider,
			schema: stage2VictimSchema,
			prompt: buildVictimPrompt({
				theme: stage1.theme,
				locationName: stage1.locationName,
			}),
			timeoutMs: timeoutMs(),
			maxAttempts: maxAttempts(),
			baseRetryDelayMs: baseRetryDelayMs(),
			stageLabel: generationStages[1],
			onAttemptFailure: logStageAttemptFailure,
			onRetryScheduled: logStageRetryScheduled,
			onFallbackUsed: logStageFallbackUsed,
			fallback: fallbackVictim,
		});

		await updateCaseGenerationProgress({
			caseId: input.caseId,
			generationProgress: stageProgress(2),
			generationStepLabel: generationStages[2],
		});

		const stage3 = await generateStructuredWithRetry({
			provider: aiProvider,
			schema: stage3WeaponsSchema,
			prompt: buildWeaponsPrompt({
				theme: stage1.theme,
				murderWound: stage2.murderWound,
			}),
			timeoutMs: timeoutMs(),
			maxAttempts: maxAttempts(),
			baseRetryDelayMs: baseRetryDelayMs(),
			stageLabel: generationStages[2],
			onAttemptFailure: logStageAttemptFailure,
			onRetryScheduled: logStageRetryScheduled,
			onFallbackUsed: logStageFallbackUsed,
			fallback: fallbackWeapons,
		});

		await updateCaseGenerationProgress({
			caseId: input.caseId,
			generationProgress: stageProgress(3),
			generationStepLabel: generationStages[3],
		});

		const stage4 = await generateStructuredWithRetry({
			provider: aiProvider,
			schema: stage4SuspectsSchema,
			prompt: buildSuspectListPrompt({ theme: stage1.theme }),
			timeoutMs: timeoutMs(),
			maxAttempts: maxAttempts(),
			baseRetryDelayMs: baseRetryDelayMs(),
			stageLabel: generationStages[3],
			onAttemptFailure: logStageAttemptFailure,
			onRetryScheduled: logStageRetryScheduled,
			onFallbackUsed: logStageFallbackUsed,
			fallback: fallbackSuspects,
		});

		await updateCaseGenerationProgress({
			caseId: input.caseId,
			generationProgress: stageProgress(4),
			generationStepLabel: generationStages[4],
		});

		const stage5 = await generateStructuredWithRetry({
			provider: aiProvider,
			schema: stage5WeaponRelationsSchema,
			prompt: buildRelationsPrompt({
				weapons: stage3.weapons,
				suspects: stage4.suspects,
			}),
			timeoutMs: timeoutMs(),
			maxAttempts: maxAttempts(),
			baseRetryDelayMs: baseRetryDelayMs(),
			stageLabel: generationStages[4],
			onAttemptFailure: logStageAttemptFailure,
			onRetryScheduled: logStageRetryScheduled,
			onFallbackUsed: logStageFallbackUsed,
			fallback: fallbackWeaponRelations,
		});

		await updateCaseGenerationProgress({
			caseId: input.caseId,
			generationProgress: stageProgress(5),
			generationStepLabel: generationStages[5],
		});

		const stage6 = await generateStructuredWithRetry({
			provider: aiProvider,
			schema: stage6AlibiNetworkSchema,
			prompt: buildAlibiNetworkPrompt({ suspects: stage4.suspects }),
			timeoutMs: heavyStageTimeoutMs(),
			maxAttempts: maxAttempts(),
			baseRetryDelayMs: baseRetryDelayMs(),
			stageLabel: generationStages[5],
			onAttemptFailure: logStageAttemptFailure,
			onRetryScheduled: logStageRetryScheduled,
			onFallbackUsed: logStageFallbackUsed,
			fallback: fallbackAlibiNetwork,
		});

		await updateCaseGenerationProgress({
			caseId: input.caseId,
			generationProgress: stageProgress(6),
			generationStepLabel: generationStages[6],
		});

		const stagedWeapons: WeaponRecord[] = stage3.weapons.map((weapon) => {
			const sightings =
				stage5.weaponSightings.find((entry) => entry.weaponName === weapon.name)
					?.seenBySuspectNames || [];

			return {
				id: randomUUID(),
				name: weapon.name,
				belongsToSuspectName: weapon.belongsToSuspectName,
				isMurderWeapon: weapon.isMurderWeapon,
				seenBySuspectNames: sightings,
			};
		});

		const stagedSuspects = await buildSuspectProfiles({
			suspects: stage4.suspects,
			alibis: stage6.alibis,
			relationships: stage6.relationships,
		});

		await updateCaseGenerationProgress({
			caseId: input.caseId,
			generationProgress: stageProgress(7),
			generationStepLabel: generationStages[7],
		});

		const caseRecord: MurderCaseRecord = {
			id: input.caseId,
			theme: stage1.theme,
			storySummary: stage1.storySummary,
			locationName: stage1.locationName,
			status: 'active',
			startedAt: input.startedAt,
			solvedAt: null,
			finalOutcome: null,
			generationProgress: 100,
			generationStepLabel: generationStages[7],
			victim: {
				name: stage2.name,
				bodyFoundRoom: stage2.bodyFoundRoom,
				timeOfDeath: stage2.timeOfDeath,
				murderWound: stage2.murderWound,
			},
			weapons: stagedWeapons,
			suspects: stagedSuspects,
			suspectRelationships: stage6.relationships,
			chats: [],
			discoveredWeapons: [],
			guessCooldownUntil: null,
		};

		validateFinalInvariants(caseRecord);

		await saveGeneratedCase(caseRecord);
	} catch (error) {
		await markCaseGenerationFailed({
			caseId: input.caseId,
			errorMessage: 'Generation failed. Try creating a new case.',
		});

		console.error('[case-generation] background generation failed', error);
	}
}

export async function getCaseById(
	caseId: string,
): Promise<MurderCaseRecord | null> {
	return findCaseById(caseId);
}
