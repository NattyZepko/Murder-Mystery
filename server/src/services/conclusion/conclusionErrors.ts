export class ConclusionError extends Error {
	readonly statusCode: number;

	constructor(message: string, statusCode = 400) {
		super(message);
		this.name = 'ConclusionError';
		this.statusCode = statusCode;
	}
}
