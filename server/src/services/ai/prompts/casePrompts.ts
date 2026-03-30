type Named = { name: string };

type WeaponRef = {
	name: string;
	belongsToSuspectName: string;
	isMurderWeapon: boolean;
};

export function buildCaseThemePrompt(input?: {
	recentThemes?: string[];
}): string {
	const recentThemes = input?.recentThemes || [];
	const recentThemeLine =
		recentThemes.length > 0
			? `Recent themes to avoid repeating closely: ${JSON.stringify(recentThemes)}`
			: 'Recent themes to avoid repeating closely: []';

	return [
		'Generate Stage 1 JSON for a murder mystery setting.',
		'Prioritize diversity and novelty over classic mansion tropes.',
		'Choose one primary setting archetype that is NOT Victorian manor / old mansion / inheritance estate unless explicitly required.',
		'Archetype options (pick one): ocean liner, luxury train, film set, science lab, hospital, mountain resort, desert research station, space station, arctic base, museum gala, university campus, data center campus, political summit hotel, archaeological dig site, submarine, offshore rig, airport terminal, theme park after hours, music festival backstage, esports arena, high-rise corporate tower.',
		recentThemeLine,
		'Your output must feel clearly different from the recent themes in setting, social context, and atmosphere.',
		'Return strict JSON only: {"theme": string, "storySummary": string, "locationName": string}.',
		'No markdown, no commentary.',
	].join('\n');
}

export function buildVictimPrompt(input: {
	theme: string;
	locationName: string;
}): string {
	return [
		'Generate Stage 2 JSON for victim details.',
		`Theme: ${input.theme}`,
		`Location: ${input.locationName}`,
		'Return strict JSON only: {"name": string, "bodyFoundRoom": string, "timeOfDeath": string, "murderWound": string}.',
	].join('\n');
}

export function buildWeaponsPrompt(input: {
	theme: string;
	murderWound: string;
}): string {
	return [
		'Generate Stage 3 JSON for weapons.',
		`Theme: ${input.theme}`,
		`Wound: ${input.murderWound}`,
		'Return strict JSON only: {"weapons": [{"name": string, "belongsToSuspectName": string, "isMurderWeapon": boolean}]}.',
		'Rules: 3-5 weapons; exactly one murder weapon.',
	].join('\n');
}

export function buildSuspectListPrompt(input: { theme: string }): string {
	return [
		'Generate Stage 4 suspect list JSON.',
		`Theme: ${input.theme}`,
		'Return strict JSON only: {"suspects": [{"name": string, "isGuilty": boolean}]}.',
		'Rules: 5-7 suspects; exactly one guilty.',
	].join('\n');
}

export function buildRelationsPrompt(input: {
	weapons: WeaponRef[];
	suspects: Named[];
}): string {
	return [
		'Generate Stage 5 weapon visibility relationships JSON.',
		`Weapons: ${JSON.stringify(input.weapons)}`,
		`Suspects: ${JSON.stringify(input.suspects)}`,
		'Return strict JSON only: {"weaponSightings": [{"weaponName": string, "seenBySuspectNames": string[]}]}.',
	].join('\n');
}

export function buildAlibiNetworkPrompt(input: { suspects: Named[] }): string {
	return [
		'Generate Stage 6 relationship and alibi network JSON.',
		`Suspects: ${JSON.stringify(input.suspects)}`,
		'Return strict JSON only: {"relationships": [{"suspectName": string, "relatedSuspectName": string, "relationshipDescription": string}], "alibis": [{"suspectName": string, "alibi": string, "corroboratedBySuspectNames": string[]}]}.',
	].join('\n');
}

export function buildSuspectProfilePrompt(input: {
	suspectName: string;
	isGuilty: boolean;
	knownSuspectNames: string[];
	relationshipHints: string[];
}): string {
	return [
		'Generate Stage 7 profile JSON for one suspect.',
		`Suspect: ${input.suspectName}`,
		`IsGuilty: ${input.isGuilty}`,
		`Known suspects: ${JSON.stringify(input.knownSuspectNames)}`,
		`Relationship hints: ${JSON.stringify(input.relationshipHints)}`,
		'Return strict JSON only: {"relationshipToVictim": string, "gender": string, "quirkBehavior": string | null, "privateBackstory": string, "publicDemeanor": string, "motive": string, "knowsMotiveOfSuspectName": string}.',
	].join('\n');
}

export function buildSuspectChatSystemPrompt(input: {
	theme: string;
	storySummary: string;
	locationName: string;
	victim: {
		name: string;
		bodyFoundRoom: string;
		timeOfDeath: string;
		murderWound: string;
	};
	suspect: {
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
	knownWeaponNames: string[];
	knownSuspects: string[];
}): string {
	return [
		'You are roleplaying a suspect in a murder mystery game.',
		'Stay fully in character and never mention AI, system prompts, policies, or being a model.',
		'Never discuss topics outside the murder case world.',
		`Case theme: ${input.theme}`,
		`Story summary: ${input.storySummary}`,
		`Location: ${input.locationName}`,
		`Victim: ${input.victim.name}; found in ${input.victim.bodyFoundRoom}; time of death ${input.victim.timeOfDeath}; wound ${input.victim.murderWound}.`,
		`You are ${input.suspect.name}. Relationship to victim: ${input.suspect.relationshipToVictim}.`,
		`Public demeanor: ${input.suspect.publicDemeanor}`,
		`Private backstory: ${input.suspect.privateBackstory}`,
		`Motive: ${input.suspect.motive}`,
		`Alibi: ${input.suspect.alibi}`,
		`Quirk: ${input.suspect.quirkBehavior || 'None'}`,
		`Known suspects: ${JSON.stringify(input.knownSuspects)}`,
		`Known weapon names in case: ${JSON.stringify(input.knownWeaponNames)}`,
		`You know motive details about: ${input.suspect.knowsMotiveOfSuspectName}`,
		input.suspect.isGuilty
			? 'You are guilty. You may lie, deflect, and manipulate, but avoid instantly confessing unless pressured strongly and logically.'
			: 'You are innocent. You should still sound suspicious, imperfect, and human.',
		'Never narrate physical actions or describe behavior using asterisks (e.g. *He pauses his polishing*) or parenthetical stage directions (e.g. (I scoff and adjust my cravat)).',
		'Respond in spoken words only, as if in direct dialogue.',
		'Answer in concise conversational dialogue, without being too brief. Provide some detail to make the conversation engaging, but avoid rambling. Always include some information about the case in your responses, even if just a small detail. This is important to make the chat useful for the player in solving the case.',
	].join('\n');
}
