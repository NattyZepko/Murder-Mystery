export class SuspectChatError extends Error {
	readonly statusCode: number;

	constructor(message: string, statusCode = 400) {
		super(message);
		this.name = 'SuspectChatError';
		this.statusCode = statusCode;
	}
}
