import type { z } from 'zod';

import {
	stage3WeaponsSchema,
	stage4SuspectsSchema,
	stage5WeaponRelationsSchema,
	stage6AlibiNetworkSchema,
	stage7ProfileSchema,
} from '../ai/validators/caseGenerationSchemas';

const fallbackThemes = [
	{
		theme: 'Arctic Research Base Lockdown',
		storySummary:
			'A blizzard seals a polar research station while a senior scientist is found dead during a power ration crisis.',
		locationName: 'Helios Ice Observatory',
	},
	{
		theme: 'Luxury Train Through the Mountains',
		storySummary:
			'A high-profile passenger is killed overnight as a private train tunnels through avalanche-prone peaks.',
		locationName: 'The Aurum Line Express',
	},
	{
		theme: 'Museum Gala Sabotage',
		storySummary:
			'A blackout during a charity gala leaves a curator dead and priceless artifacts unaccounted for.',
		locationName: 'Marrowgate Museum of Antiquities',
	},
	{
		theme: 'Orbital Habitat Crisis',
		storySummary:
			'In a low-orbit habitat ring, an engineer is murdered as life-support reserves drop and trust fractures.',
		locationName: 'Kepler Ring Station',
	},
	{
		theme: 'Offshore Platform Conspiracy',
		storySummary:
			'A storm isolates an offshore platform after a safety chief is found dead beside a tampered pressure valve.',
		locationName: 'Blackwater-9 Platform',
	},
	{
		theme: 'Film Studio Night Shoot',
		storySummary:
			'During a closed-set night shoot, a producer is found dead in a fabricated alley set with real blood leading offstage.',
		locationName: 'Orchid Vale Studios',
	},
	{
		theme: 'Tech Campus Data Breach',
		storySummary:
			'A chief architect is killed hours after exposing an internal leak at a fortified AI campus.',
		locationName: 'Nexis Quantum Campus',
	},
];

function normalizeThemeText(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
}

export function fallbackTheme(input?: { recentThemes?: string[] }) {
	const recent = (input?.recentThemes || []).map(normalizeThemeText);
	const nonRepeating = fallbackThemes.filter((candidate) => {
		const normalizedCandidate = normalizeThemeText(candidate.theme);
		return !recent.some(
			(entry) =>
				entry.includes(normalizedCandidate) ||
				normalizedCandidate.includes(entry),
		);
	});

	const pool = nonRepeating.length > 0 ? nonRepeating : fallbackThemes;
	const selected = pool[Math.floor(Math.random() * pool.length)];
	return selected;
}

export function fallbackVictim() {
	return {
		name: 'Edgar Wren',
		bodyFoundRoom: 'Library',
		timeOfDeath: '11:40 PM',
		murderWound: 'Single deep puncture wound to the chest',
	};
}

export function fallbackWeapons(): z.infer<typeof stage3WeaponsSchema> {
	return {
		weapons: [
			{
				name: 'Antique Letter Opener',
				belongsToSuspectName: 'Lena Hart',
				isMurderWeapon: false,
			},
			{
				name: 'Fencing Foil',
				belongsToSuspectName: 'Victor Hale',
				isMurderWeapon: true,
			},
			{
				name: 'Carving Knife',
				belongsToSuspectName: 'Mara Quinn',
				isMurderWeapon: false,
			},
		],
	};
}

export function fallbackSuspects(): z.infer<typeof stage4SuspectsSchema> {
	return {
		suspects: [
			{ name: 'Lena Hart', isGuilty: false },
			{ name: 'Victor Hale', isGuilty: true },
			{ name: 'Mara Quinn', isGuilty: false },
			{ name: 'Jonas Pike', isGuilty: false },
			{ name: 'Clara Voss', isGuilty: false },
		],
	};
}

export function fallbackWeaponRelations(): z.infer<
	typeof stage5WeaponRelationsSchema
> {
	return fallbackWeaponRelationsForScenario();
}

export function fallbackWeaponRelationsForScenario(input?: {
	weapons?: Array<{
		name: string;
		belongsToSuspectName: string | null;
		isMurderWeapon: boolean;
	}>;
	suspects?: Array<{
		name: string;
		isGuilty: boolean;
	}>;
}): z.infer<typeof stage5WeaponRelationsSchema> {
	if (!input?.weapons?.length || !input?.suspects?.length) {
		return {
			weaponSightings: [
				{
					weaponName: 'Antique Letter Opener',
					seenBySuspectNames: ['Lena Hart', 'Clara Voss'],
				},
				{
					weaponName: 'Fencing Foil',
					seenBySuspectNames: ['Victor Hale', 'Jonas Pike'],
				},
				{ weaponName: 'Carving Knife', seenBySuspectNames: ['Mara Quinn'] },
			],
		};
	}

	const suspectNames = input.suspects.map((suspect) => suspect.name);
	const guiltySuspectName =
		input.suspects.find((suspect) => suspect.isGuilty)?.name || suspectNames[0];

	return {
		weaponSightings: input.weapons.map((weapon, index) => {
			const seenBy = new Set<string>();

			if (weapon.belongsToSuspectName) {
				seenBy.add(weapon.belongsToSuspectName);
			}

			seenBy.add(suspectNames[index % suspectNames.length]);
			seenBy.add(suspectNames[(index + 2) % suspectNames.length]);

			if (weapon.isMurderWeapon && guiltySuspectName) {
				seenBy.add(guiltySuspectName);
			}

			return {
				weaponName: weapon.name,
				seenBySuspectNames: Array.from(seenBy),
			};
		}),
	};
}

export function fallbackAlibiNetwork(): z.infer<
	typeof stage6AlibiNetworkSchema
> {
	return {
		relationships: [
			{
				suspectName: 'Lena Hart',
				relatedSuspectName: 'Mara Quinn',
				relationshipDescription: 'Former business partners',
			},
			{
				suspectName: 'Jonas Pike',
				relatedSuspectName: 'Victor Hale',
				relationshipDescription: 'Rivals in the estate trust',
			},
		],
		alibis: [
			{
				suspectName: 'Lena Hart',
				alibi: 'Was in the conservatory reviewing letters',
				corroboratedBySuspectNames: ['Clara Voss'],
			},
			{
				suspectName: 'Victor Hale',
				alibi: 'Claims he was alone on the terrace',
				corroboratedBySuspectNames: [],
			},
			{
				suspectName: 'Mara Quinn',
				alibi: 'In the kitchen preparing tea',
				corroboratedBySuspectNames: ['Lena Hart'],
			},
			{
				suspectName: 'Jonas Pike',
				alibi: 'In the billiard room tallying debts',
				corroboratedBySuspectNames: ['Clara Voss'],
			},
			{
				suspectName: 'Clara Voss',
				alibi: 'In the conservatory with Lena',
				corroboratedBySuspectNames: ['Lena Hart'],
			},
		],
	};
}

export function fallbackProfile(input: {
	suspectName: string;
	isGuilty: boolean;
	knowsMotiveOfSuspectName: string;
}): z.infer<typeof stage7ProfileSchema> {
	if (input.isGuilty) {
		return {
			relationshipToVictim: 'Disinherited nephew',
			gender: 'male',
			quirkBehavior: 'Speaks with clipped confidence when cornered',
			privateBackstory:
				'Victor believed Edgar stole his future and staged debts to force him out.',
			publicDemeanor: 'Polished and defensive, often redirecting questions.',
			motive: 'Financial ruin and resentment over being cut out of the will.',
			knowsMotiveOfSuspectName: input.knowsMotiveOfSuspectName,
		};
	}

	return {
		relationshipToVictim: 'Long-time household associate',
		gender: 'female',
		quirkBehavior: null,
		privateBackstory:
			'Carries unresolved guilt about old disputes but had no reason to kill Edgar.',
		publicDemeanor:
			'Nervous but cooperative, occasionally evasive under pressure.',
		motive: 'Wanted recognition, not violence, after years of being dismissed.',
		knowsMotiveOfSuspectName: input.knowsMotiveOfSuspectName,
	};
}
