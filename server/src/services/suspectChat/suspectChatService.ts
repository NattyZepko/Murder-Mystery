import { detectMentionedWeapons } from '../../utils/detectMentionedWeapons';
import { GeminiProvider } from '../ai/adapters/geminiProvider';
import { buildSuspectChatSystemPrompt } from '../ai/prompts/casePrompts';
import {
	addDiscoveredWeapons,
	findCaseInteractionById,
	saveSuspectChatExchange,
} from '../persistence/interactionRepository';
import { SuspectChatError } from './suspectChatErrors';

const aiProvider = new GeminiProvider();

type SendMessageToSuspectInput = {
	caseId: string;
	suspectId: string;
	message: string;
};

function sanitizeSuspectReply(reply: string): string {
	let cleaned = reply.trim();

	// Remove italicized stage directions such as *sighs*.
	cleaned = cleaned.replace(/\*[^*\n]{1,240}\*/g, ' ').trim();

	// Remove parenthetical action lines and repeated leading parentheticals.
	cleaned = cleaned.replace(/(?:^|\n)\s*\([^()\n]{1,260}\)\s*(?=\n|$)/g, ' ');
	while (/^\s*\([^()\n]{1,260}\)\s*/.test(cleaned)) {
		cleaned = cleaned.replace(/^\s*\([^()\n]{1,260}\)\s*/, '').trim();
	}

	// Normalize whitespace without flattening paragraph breaks.
	cleaned = cleaned
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	if (cleaned.length > 0) {
		return cleaned;
	}

	return reply
		.replace(/[()*]/g, '')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
}

export async function sendMessageToSuspect(input: SendMessageToSuspectInput) {
	if (!input.message.trim()) {
		throw new SuspectChatError('Message is required', 400);
	}

	const caseRecord = await findCaseInteractionById(input.caseId);
	if (!caseRecord) {
		throw new SuspectChatError('Case not found', 404);
	}

	if (caseRecord.status !== 'active') {
		throw new SuspectChatError(
			'Chat is unavailable unless case is active',
			409,
		);
	}

	const suspect = caseRecord.suspects.find(
		(entry) => entry.id === input.suspectId,
	);
	if (!suspect) {
		throw new SuspectChatError('Suspect not found in this case', 404);
	}

	const history = caseRecord.chats
		.filter((entry) => entry.suspectId === input.suspectId)
		.map((entry) => ({
			role: entry.role,
			content: entry.content,
		}));

	const systemPrompt = buildSuspectChatSystemPrompt({
		theme: caseRecord.theme,
		storySummary: caseRecord.storySummary,
		locationName: caseRecord.locationName,
		victim: {
			name: caseRecord.victimName,
			bodyFoundRoom: caseRecord.victimBodyFoundRoom,
			timeOfDeath: caseRecord.victimTimeOfDeath,
			murderWound: caseRecord.victimMurderWound,
		},
		suspect,
		knownWeaponNames: caseRecord.weapons.map((weapon) => weapon.name),
		knownSuspects: caseRecord.suspects.map((entry) => entry.name),
	});

	let suspectReply: string;
	try {
		suspectReply = await aiProvider.generateChatReply({
			systemPrompt,
			userMessage: input.message,
			history,
			timeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000),
		});
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		console.error('[suspect-chat] AI call failed:', reason);
		throw new SuspectChatError(
			'The suspect is unavailable right now. Please try again.',
			503,
		);
	}
	const sanitizedReply = sanitizeSuspectReply(suspectReply);

	await saveSuspectChatExchange({
		caseId: input.caseId,
		suspectId: input.suspectId,
		userMessage: input.message,
		suspectReply: sanitizedReply,
	});

	const detectedWeapons = detectMentionedWeapons(
		sanitizedReply,
		caseRecord.weapons.map((weapon) => ({ id: weapon.id, name: weapon.name })),
	);

	const newWeaponIds = detectedWeapons
		.map((weapon) => weapon.weaponId)
		.filter(
			(weaponId) =>
				!caseRecord.discoveredWeapons.some(
					(entry) => entry.weaponId === weaponId,
				),
		);

	if (newWeaponIds.length > 0) {
		await addDiscoveredWeapons({
			caseId: input.caseId,
			weaponIds: newWeaponIds,
			discoveredBySuspectId: input.suspectId,
		});
	}

	return {
		reply: sanitizedReply,
		discoveredWeapons: detectedWeapons,
	};
}
