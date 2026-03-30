import { z } from 'zod';

import type {
	AIGenerationRequest,
	AIGenerationResult,
	AIProvider,
	CharacterChatInput,
	StructuredGenerationInput,
} from '../providers/aiProvider';
import { validateAIJson } from '../validators/aiJsonValidator';

type GeminiResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{ text?: string }>;
		};
		finishReason?: string;
	}>;
	promptFeedback?: {
		blockReason?: string;
	};
	error?: {
		message?: string;
	};
};

function extractTextFromGeminiResponse(payload: GeminiResponse): string {
	if (payload.error?.message) {
		throw new Error(`Gemini error: ${payload.error.message}`);
	}

	if (payload.promptFeedback?.blockReason) {
		throw new Error(
			`Gemini blocked prompt: ${payload.promptFeedback.blockReason}`,
		);
	}

	const candidate = payload.candidates?.[0];
	const parts = candidate?.content?.parts ?? [];
	const text = parts
		.map((part) => part.text || '')
		.join('')
		.trim();

	if (!text) {
		throw new Error(
			`Gemini returned empty response${candidate?.finishReason ? ` (${candidate.finishReason})` : ''}`,
		);
	}

	return text;
}

function normalizeStructuredJsonText(rawText: string): string {
	const trimmed = rawText.trim();

	if (trimmed.startsWith('```')) {
		const withoutFence = trimmed
			.replace(/^```json\s*/i, '')
			.replace(/^```\s*/i, '')
			.replace(/\s*```$/, '');
		return withoutFence.trim();
	}

	const firstBrace = trimmed.indexOf('{');
	const lastBrace = trimmed.lastIndexOf('}');

	if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
		return trimmed.slice(firstBrace, lastBrace + 1);
	}

	return trimmed;
}

export class GeminiProvider implements AIProvider {
	async generate(request: AIGenerationRequest): Promise<AIGenerationResult> {
		const timeoutMs =
			request.timeoutMs || Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000);
		const apiKey = process.env.GEMINI_API_KEY;
		const model = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

		if (!apiKey) {
			throw new Error('Missing GEMINI_API_KEY');
		}

		const controller = new AbortController();
		const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						contents: [
							{
								role: 'user',
								parts: [{ text: request.prompt }],
							},
						],
					}),
					signal: controller.signal,
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Gemini HTTP ${response.status}: ${errorText}`);
			}

			const payload = (await response.json()) as GeminiResponse;
			return { text: extractTextFromGeminiResponse(payload) };
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(`Gemini request timed out after ${timeoutMs}ms`);
			}

			throw error;
		} finally {
			clearTimeout(timeoutHandle);
		}
	}

	async generateStructured<T extends z.ZodTypeAny>(
		input: StructuredGenerationInput<T>,
	): Promise<z.infer<T>> {
		const raw = await this.generate({
			prompt: input.prompt,
			timeoutMs: input.timeoutMs,
		});

		return validateAIJson(input.schema, normalizeStructuredJsonText(raw.text));
	}

	async generateChatReply(input: CharacterChatInput): Promise<string> {
		const apiKey = process.env.GEMINI_API_KEY;
		const model = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

		if (!apiKey) {
			throw new Error('Missing GEMINI_API_KEY');
		}

		const controller = new AbortController();
		const timeoutHandle = setTimeout(() => controller.abort(), input.timeoutMs);

		try {
			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						systemInstruction: {
							parts: [{ text: input.systemPrompt }],
						},
						contents: [
							...input.history.map((entry) => ({
								role: entry.role === 'suspect' ? 'model' : 'user',
								parts: [{ text: entry.content }],
							})),
							{
								role: 'user',
								parts: [{ text: input.userMessage }],
							},
						],
					}),
					signal: controller.signal,
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Gemini HTTP ${response.status}: ${errorText}`);
			}

			const payload = (await response.json()) as GeminiResponse;
			return extractTextFromGeminiResponse(payload);
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(`Gemini request timed out after ${input.timeoutMs}ms`);
			}

			throw error;
		} finally {
			clearTimeout(timeoutHandle);
		}
	}
}
