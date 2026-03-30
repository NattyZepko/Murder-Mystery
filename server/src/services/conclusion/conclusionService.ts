import dayjs from 'dayjs';

import {
	createGuessAttempt,
	findCaseInteractionById,
	markCaseSolved,
	setGuessCooldown,
} from '../persistence/interactionRepository';
import { ConclusionError } from './conclusionErrors';

type SubmitConclusionInput = {
	caseId: string;
	guessedSuspectId: string;
	guessedWeaponId: string;
	mode?: 'submit' | 'cooldownOnly';
};

function getLockedRemainingSeconds(lockedUntil: Date | null): number {
	if (!lockedUntil) {
		return 0;
	}

	const now = dayjs();
	const endsAt = dayjs(lockedUntil);
	if (endsAt.isBefore(now)) {
		return 0;
	}

	return endsAt.diff(now, 'second');
}

export async function submitConclusion(input: SubmitConclusionInput) {
	const caseRecord = await findCaseInteractionById(input.caseId);
	if (!caseRecord) {
		throw new ConclusionError('Case not found', 404);
	}

	const lockedUntil = caseRecord.guessCooldown?.lockedUntil || null;
	const lockedRemainingSeconds = getLockedRemainingSeconds(lockedUntil);

	if (input.mode === 'cooldownOnly') {
		return {
			lockedUntil: lockedUntil ? lockedUntil.toISOString() : null,
			lockedRemainingSeconds,
		};
	}

	if (caseRecord.status !== 'active') {
		throw new ConclusionError(
			'Conclusion can only be submitted on active cases',
			409,
		);
	}

	if (lockedRemainingSeconds > 0) {
		throw new ConclusionError(
			`Guessing is locked. Try again in ${lockedRemainingSeconds}s`,
			423,
		);
	}

	if (!input.guessedSuspectId || !input.guessedWeaponId) {
		throw new ConclusionError('Both suspectId and weaponId are required', 400);
	}

	if (caseRecord.discoveredWeapons.length === 0) {
		throw new ConclusionError(
			'At least one weapon must be discovered before guessing',
			400,
		);
	}

	const guessedSuspect = caseRecord.suspects.find(
		(suspect) => suspect.id === input.guessedSuspectId,
	);
	if (!guessedSuspect) {
		throw new ConclusionError('Invalid suspect selection', 400);
	}

	const guessedWeapon = caseRecord.weapons.find(
		(weapon) => weapon.id === input.guessedWeaponId,
	);
	if (!guessedWeapon) {
		throw new ConclusionError('Invalid weapon selection', 400);
	}

	const isWeaponDiscovered = caseRecord.discoveredWeapons.some(
		(entry) => entry.weaponId === input.guessedWeaponId,
	);
	if (!isWeaponDiscovered) {
		throw new ConclusionError(
			'Guessed weapon must come from discovered weapons',
			400,
		);
	}

	const isCorrect = guessedSuspect.isGuilty && guessedWeapon.isMurderWeapon;

	await createGuessAttempt({
		caseId: input.caseId,
		guessedSuspectId: input.guessedSuspectId,
		guessedWeaponId: input.guessedWeaponId,
		isCorrect,
	});

	if (isCorrect) {
		const solvedAt = new Date();
		await markCaseSolved({
			caseId: input.caseId,
			solvedAt,
			finalOutcome: `${guessedSuspect.name} used ${guessedWeapon.name}`,
		});

		await setGuessCooldown({
			caseId: input.caseId,
			lockedUntil: null,
		});

		return {
			isCorrect: true,
			lockedUntil: null,
			lockedRemainingSeconds: 0,
			solvedAt: solvedAt.toISOString(),
			solution: {
				suspectId: guessedSuspect.id,
				suspectName: guessedSuspect.name,
				weaponId: guessedWeapon.id,
				weaponName: guessedWeapon.name,
			},
		};
	}

	const nextLockedUntil = dayjs().add(60, 'second').toDate();
	await setGuessCooldown({
		caseId: input.caseId,
		lockedUntil: nextLockedUntil,
	});

	return {
		isCorrect: false,
		lockedUntil: nextLockedUntil.toISOString(),
		lockedRemainingSeconds: getLockedRemainingSeconds(nextLockedUntil),
		solvedAt: null,
	};
}
