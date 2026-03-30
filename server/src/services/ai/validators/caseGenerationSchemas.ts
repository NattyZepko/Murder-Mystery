import { z } from 'zod';

export const stage1ThemeSchema = z.object({
	theme: z.string().min(3),
	storySummary: z.string().min(10),
	locationName: z.string().min(3),
});

export const stage2VictimSchema = z.object({
	name: z.string().min(2),
	bodyFoundRoom: z.string().min(2),
	timeOfDeath: z.string().min(2),
	murderWound: z.string().min(2),
});

const stage3WeaponSchema = z.object({
	name: z.string().min(2),
	belongsToSuspectName: z.string().min(2),
	isMurderWeapon: z.boolean(),
});

export const stage3WeaponsSchema = z
	.object({
		weapons: z.array(stage3WeaponSchema).min(3).max(5),
	})
	.refine(
		(data) =>
			data.weapons.filter((weapon) => weapon.isMurderWeapon).length === 1,
		{ message: 'Exactly one weapon must be marked as murder weapon' },
	);

const stage4SuspectSchema = z.object({
	name: z.string().min(2),
	isGuilty: z.boolean(),
});

export const stage4SuspectsSchema = z
	.object({
		suspects: z.array(stage4SuspectSchema).min(5).max(7),
	})
	.refine(
		(data) => data.suspects.filter((suspect) => suspect.isGuilty).length === 1,
		{ message: 'Exactly one suspect must be marked guilty' },
	);

export const stage5WeaponRelationsSchema = z.object({
	weaponSightings: z.array(
		z.object({
			weaponName: z.string().min(2),
			seenBySuspectNames: z.array(z.string().min(2)).min(1),
		}),
	),
});

export const stage6AlibiNetworkSchema = z.object({
	relationships: z.array(
		z.object({
			suspectName: z.string().min(2),
			relatedSuspectName: z.string().min(2),
			relationshipDescription: z.string().min(3),
		}),
	),
	alibis: z.array(
		z.object({
			suspectName: z.string().min(2),
			alibi: z.string().min(3),
			corroboratedBySuspectNames: z.array(z.string().min(2)),
		}),
	),
});

export const stage7ProfileSchema = z.object({
	relationshipToVictim: z.string().min(3),
	gender: z.string().min(2),
	quirkBehavior: z.string().nullable(),
	privateBackstory: z.string().min(10),
	publicDemeanor: z.string().min(10),
	motive: z.string().min(5),
	knowsMotiveOfSuspectName: z.string().min(2),
});
