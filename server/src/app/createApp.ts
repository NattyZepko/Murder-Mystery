import cors from 'cors';
import express from 'express';

import { caseRouter, healthRouter } from '../routes';

export function createApp() {
	const app = express();

	app.use(cors());
	app.use(express.json());

	app.use('/api/health', healthRouter);
	app.use('/api/cases', caseRouter);

	return app;
}
