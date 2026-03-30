type WeaponRef = {
	id: string;
	name: string;
};

type DetectedWeapon = {
	weaponId: string;
	weaponName: string;
};

function normalizeForMatch(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function detectMentionedWeapons(
	message: string,
	knownWeapons: WeaponRef[],
): DetectedWeapon[] {
	const normalizedMessage = normalizeForMatch(message);
	const found: DetectedWeapon[] = [];

	for (const weapon of knownWeapons) {
		const normalizedWeapon = normalizeForMatch(weapon.name);
		if (!normalizedWeapon) {
			continue;
		}

		const pattern = new RegExp(
			`(^|\\s)${normalizedWeapon.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(\\s|$)`,
			'i',
		);

		if (pattern.test(normalizedMessage)) {
			found.push({
				weaponId: weapon.id,
				weaponName: weapon.name,
			});
		}
	}

	return found;
}
