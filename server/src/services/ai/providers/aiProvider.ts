import { z } from 'zod';

export type AIGenerationRequest = {
	prompt: string;
	timeoutMs: number;
};

export type AIGenerationResult = {
	text: string;
};

export type StructuredGenerationInput<T extends z.ZodTypeAny> = {
	prompt: string;
	timeoutMs: number;
	schema: T;
};

export type CharacterChatInput = {
	systemPrompt: string;
	userMessage: string;
	history: Array<{ role: 'user' | 'suspect' | 'system'; content: string }>;
	timeoutMs: number;
};

export interface AIProvider {
	generate(request: AIGenerationRequest): Promise<AIGenerationResult>;
	generateStructured<T extends z.ZodTypeAny>(
		input: StructuredGenerationInput<T>,
	): Promise<z.infer<T>>;
	generateChatReply(input: CharacterChatInput): Promise<string>;
}
