export class CaseGenerationFailedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CaseGenerationFailedError';
	}
}
