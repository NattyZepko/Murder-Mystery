import { z } from 'zod';

export function validateAIJson<T extends z.ZodTypeAny>(
	schema: T,
	rawText: string,
): z.infer<T> {
	const parsed = JSON.parse(rawText);
	return schema.parse(parsed);
}
