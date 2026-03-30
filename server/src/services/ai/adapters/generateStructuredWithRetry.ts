import { z } from 'zod';

import type { AIProvider } from '../providers/aiProvider';

type GenerateStructuredWithRetryInput<T extends z.ZodTypeAny> = {
	provider: AIProvider;
	schema: T;
	prompt: string;
	timeoutMs: number;
	maxAttempts: number;
	fallback: () => z.infer<T>;
	baseRetryDelayMs?: number;
	maxRetryDelayMs?: number;
	shouldRetry?: (details: {
		attempt: number;
		error: unknown;
		errorMessage: string;
	}) => boolean;
	onAttemptFailure?: (details: {
		attempt: number;
		stageLabel: string;
		errorMessage: string;
	}) => void;
	onRetryScheduled?: (details: {
		attempt: number;
		nextAttempt: number;
		stageLabel: string;
		delayMs: number;
		errorMessage: string;
	}) => void;
	onFallbackUsed?: (details: {
		stageLabel: string;
		maxAttempts: number;
		lastErrorMessage: string;
	}) => void;
	stageLabel: string;
};

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(input: {
	attempt: number;
	baseRetryDelayMs: number;
	maxRetryDelayMs: number;
}): number {
	const exponential =
		input.baseRetryDelayMs * Math.pow(2, Math.max(0, input.attempt - 1));
	return Math.min(input.maxRetryDelayMs, exponential);
}

export async function generateStructuredWithRetry<T extends z.ZodTypeAny>(
	input: GenerateStructuredWithRetryInput<T>,
): Promise<z.infer<T>> {
	const baseRetryDelayMs = input.baseRetryDelayMs ?? 500;
	const maxRetryDelayMs = input.maxRetryDelayMs ?? 3000;
	let lastErrorMessage = 'Unknown error';

	for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
		try {
			return await input.provider.generateStructured({
				prompt: input.prompt,
				timeoutMs: input.timeoutMs,
				schema: input.schema,
			});
		} catch (error) {
			lastErrorMessage =
				error instanceof Error ? error.message : 'Unknown error';

			input.onAttemptFailure?.({
				attempt,
				stageLabel: input.stageLabel,
				errorMessage: lastErrorMessage,
			});

			const canRetry =
				attempt < input.maxAttempts &&
				(input.shouldRetry
					? input.shouldRetry({
							attempt,
							error,
							errorMessage: lastErrorMessage,
						})
					: true);

			if (!canRetry) {
				break;
			}

			const delayMs = getRetryDelayMs({
				attempt,
				baseRetryDelayMs,
				maxRetryDelayMs,
			});

			input.onRetryScheduled?.({
				attempt,
				nextAttempt: attempt + 1,
				stageLabel: input.stageLabel,
				delayMs,
				errorMessage: lastErrorMessage,
			});

			await wait(delayMs);
		}
	}

	input.onFallbackUsed?.({
		stageLabel: input.stageLabel,
		maxAttempts: input.maxAttempts,
		lastErrorMessage,
	});

	return input.schema.parse(input.fallback());
}
