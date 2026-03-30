import type {
	CooldownResponse,
	GuessResponse,
	MurderCase,
	SuspectChatResponse,
} from '../types/case';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

function getApiBaseUrls(): string[] {
	const baseUrls: string[] = [];

	// Prefer same-origin requests so Vite proxy can handle backend routing in dev.
	baseUrls.push('');

	if (configuredApiBaseUrl) {
		baseUrls.push(configuredApiBaseUrl);
		return [...new Set(baseUrls)];
	}

	baseUrls.push('http://localhost:4001');
	return [...new Set(baseUrls)];
}

async function requestJson<T>(input: {
	path: string;
	method?: 'GET' | 'POST';
	body?: unknown;
}): Promise<T> {
	const baseUrls = getApiBaseUrls();
	let lastNetworkError: Error | null = null;
	const attemptErrors: string[] = [];

	for (const baseUrl of baseUrls) {
		try {
			const response = await fetch(`${baseUrl}${input.path}`, {
				method: input.method || 'GET',
				headers: input.body
					? {
							'Content-Type': 'application/json',
						}
					: undefined,
				body: input.body ? JSON.stringify(input.body) : undefined,
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => null);
				const errorMessage =
					payload?.error ||
					`Request failed (${response.status}) on ${baseUrl}${input.path}`;
				throw new Error(errorMessage);
			}

			return (await response.json()) as T;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Unknown network error';
			attemptErrors.push(`${baseUrl}${input.path}: ${message}`);

			if (error instanceof Error) {
				lastNetworkError = error;
			} else {
				lastNetworkError = new Error('Unknown network error');
			}
		}
	}

	throw new Error(
		`[API_DIAGNOSTIC] ${lastNetworkError?.message || 'Failed request'} | Attempts: ${attemptErrors.join(' ; ')}`,
	);
}

export async function createCase(): Promise<MurderCase> {
	return requestJson<MurderCase>({
		path: '/api/cases/generate',
		method: 'POST',
	});
}

export async function fetchCase(caseId: string): Promise<MurderCase> {
	return requestJson<MurderCase>({ path: `/api/cases/${caseId}` });
}

export async function sendMessageToSuspect(input: {
	caseId: string;
	suspectId: string;
	message: string;
}): Promise<SuspectChatResponse> {
	return requestJson<SuspectChatResponse>({
		path: `/api/cases/${input.caseId}/suspects/${input.suspectId}/chat`,
		method: 'POST',
		body: { message: input.message },
	});
}

export async function submitGuess(input: {
	caseId: string;
	suspectId: string;
	weaponId: string;
}): Promise<GuessResponse> {
	return requestJson<GuessResponse>({
		path: `/api/cases/${input.caseId}/guess`,
		method: 'POST',
		body: {
			suspectId: input.suspectId,
			weaponId: input.weaponId,
		},
	});
}

export async function fetchGuessCooldown(
	caseId: string,
): Promise<CooldownResponse> {
	return requestJson<CooldownResponse>({
		path: `/api/cases/${caseId}/cooldown`,
	});
}
