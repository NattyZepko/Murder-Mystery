# AI Murder Mystery

A full-stack detective game where every new run generates a fresh murder case with AI-driven suspects, discoverable weapons, persistent chat history, and a final accusation flow.

The app is built as a monorepo with a React client, an Express API, PostgreSQL persistence through Prisma, and a provider-agnostic AI layer currently backed by Gemini.

## Key files (start here)

These are the fastest files to read if you want to understand the project without scanning the whole repo first:

- App entry point: [client/src/main.tsx](client/src/main.tsx)
- Top-level app shell: [client/src/App.tsx](client/src/App.tsx)
- Main gameplay UI, generation progress, chat, timer, and guessing flow: [client/src/pages/MainGamePage.tsx](client/src/pages/MainGamePage.tsx)
- Client API layer used by the UI: [client/src/api/caseApi.ts](client/src/api/caseApi.ts)
- Shared client case types: [client/src/types/case.ts](client/src/types/case.ts)
- Server entry point: [server/src/index.ts](server/src/index.ts)
- Express app wiring: [server/src/app/createApp.ts](server/src/app/createApp.ts)
- Main case routes: [server/src/routes/caseRoutes.ts](server/src/routes/caseRoutes.ts)
- Case generation pipeline: [server/src/services/caseGeneration/caseGenerationService.ts](server/src/services/caseGeneration/caseGenerationService.ts)
- Suspect chat service: [server/src/services/suspectChat/suspectChatService.ts](server/src/services/suspectChat/suspectChatService.ts)
- Conclusion and cooldown rules: [server/src/services/conclusion/conclusionService.ts](server/src/services/conclusion/conclusionService.ts)
- Database schema: [server/prisma/schema.prisma](server/prisma/schema.prisma)
- Product specification: [instructions.prompt.md](instructions.prompt.md)

GitHub will resolve those relative links automatically. For example, [server/src/index.ts](server/src/index.ts) maps to the repository file view on GitHub.

## Tech stack

- Frontend: React, TypeScript, Vite, React Query, CSS Modules
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL, Prisma ORM
- AI: Gemini through a provider-agnostic adapter layer
- Validation: Zod
- Utilities: Day.js, UUID support, dotenv

## Features

- New murder case generated for each session
- Multi-stage case generation with visible progress in the UI
- AI suspect chat with per-suspect conversation history
- Weapon discovery through interrogation rather than immediate full reveal
- Final accusation flow for suspect and weapon
- Cooldown after incorrect accusations
- Live game timer
- Solved-state modal and confetti celebration
- Server-side invariant checks to keep cases logically consistent
- Fallback handling for malformed or timed-out AI responses during generation

## Overall system design

At a high level, the project works as a client-server detective game loop.

### Data flow

1. The player starts a case from the client.
2. The server creates a case skeleton immediately and begins background generation.
3. The client polls case state and renders the current stage of generation.
4. Once the case is active, the player interviews suspects.
5. Suspect replies can reveal weapon names, which are then added to the discovered weapons list.
6. The player submits one suspect and one discovered weapon as the accusation.
7. The server either solves the case or starts a cooldown after a wrong guess.

### Code map

- [client/src/pages/MainGamePage.tsx](client/src/pages/MainGamePage.tsx): the main stateful game screen, including generation progress, suspect tabs, optimistic chat flow, timer, and conclusion UI
- [client/src/api/caseApi.ts](client/src/api/caseApi.ts): fetch layer for case creation, polling, suspect chat, and guessing
- [server/src/app/createApp.ts](server/src/app/createApp.ts): Express app setup and route registration
- [server/src/routes/caseRoutes.ts](server/src/routes/caseRoutes.ts): public case-related HTTP endpoints
- [server/src/services/caseGeneration/caseGenerationService.ts](server/src/services/caseGeneration/caseGenerationService.ts): staged AI pipeline, retries, fallbacks, and invariant validation
- [server/src/services/suspectChat/suspectChatService.ts](server/src/services/suspectChat/suspectChatService.ts): in-character suspect replies, sanitization, and weapon discovery
- [server/src/services/conclusion/conclusionService.ts](server/src/services/conclusion/conclusionService.ts): final guess validation, cooldown rules, and solved-state transition
- [server/prisma/schema.prisma](server/prisma/schema.prisma): persistent domain model

## How the game works

### Core rules

- Each case has exactly one guilty suspect.
- Each case has exactly one true murder weapon.
- Each case contains 5 to 7 suspects.
- Each case contains 3 to 5 weapons.
- The player can only guess with a weapon that has already been discovered.
- At least one weapon must be discovered before a guess is allowed.

### Investigation flow

- Start a case and wait while the backend generates the setting, victim, weapons, suspects, alibis, and suspect profiles.
- Read the visible case summary and victim details.
- Switch between suspect tabs and question each suspect directly.
- Use contradictions, tone, motive, and weapon mentions to narrow the field.
- Watch the discovered weapons list grow as suspects mention them in conversation.
- Submit a suspect and weapon when you think you have the solution.

### Guessing rules

- A correct guess solves the case immediately.
- A wrong guess creates a 60-second cooldown before another accusation is allowed.
- Cooldown state is enforced on the server, not just in the UI.

### Suspect chat behavior

- Suspects are prompted to stay in character.
- Chat history is stored per suspect, so switching tabs preserves the ongoing conversation.
- Replies are sanitized on the server to remove stage-direction style narration before they are stored and returned.

## Case generation pipeline

The server builds a case in structured stages so the UI can show progress and the backend can validate each step.

Current stages:

1. Generating setting
2. Defining victim
3. Forging weapons
4. Choosing suspects
5. Mapping weapon visibility
6. Building relationships and alibis
7. Building suspect profiles
8. Finalizing case

Each stage uses validated AI output, retry logic, timeout guards, and deterministic fallback data when needed.

## API overview

Main API endpoints exposed by the server:

- `POST /api/cases/generate`: create a new case
- `POST /api/cases`: alternate create-case route
- `GET /api/cases/:caseId`: fetch the current case state
- `POST /api/cases/:caseId/suspects/:suspectId/chat`: send a message to a suspect
- `POST /api/cases/:caseId/guess`: submit the final accusation
- `GET /api/cases/:caseId/cooldown`: fetch active cooldown state
- `GET /api/health`: health check

## Repository structure

```txt
Murder-Mystery/
	client/
		src/
			api/
			components/
			features/
			hooks/
			pages/
			types/
			utils/
	server/
		prisma/
		src/
			app/
			controllers/
			db/
			routes/
			services/
				ai/
				caseGeneration/
				conclusion/
				persistence/
				suspectChat/
			types/
			utils/
	shared/
		constants/
		schemas/
		types/
	.env.example
	docker-compose.yml
	instructions.prompt.md
```

## Run locally

Requirements:

- Node.js 20+
- npm
- Docker Desktop or another Docker-compatible runtime
- Gemini API key

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env`

Copy `.env.example` to `.env` and fill in your values.

Example:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/murder_mystery?schema=public"
PORT=4001
GEMINI_API_KEY="your_api_key_here"
AI_REQUEST_TIMEOUT_MS=30000
AI_HEAVY_STAGE_TIMEOUT_MS=45000
AI_MAX_ATTEMPTS=3
AI_RETRY_BASE_DELAY_MS=600
VITE_API_BASE_URL="http://localhost:4001"
```

### 3. Start PostgreSQL

```bash
npm run db:up
```

### 4. Generate Prisma client

```bash
npm run db:generate
```

### 5. Apply migrations

```bash
npm run db:migrate
```

### 6. Start the backend

```bash
npm run dev:server
```

### 7. Start the frontend

```bash
npm run dev:client
```

Expected local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4001`

In development, Vite proxies `/api` requests to the Express backend.

## Workspace scripts

Root scripts:

- `npm run dev`
- `npm run dev:server`
- `npm run dev:client`
- `npm run build`
- `npm run test`
- `npm run lint`
- `npm run db:up`
- `npm run db:down`
- `npm run db:logs`
- `npm run db:generate`
- `npm run db:migrate`

## Tests

```bash
npm run test
```

At the moment, the workspace test scripts are placeholders and do not yet run a real automated test suite.

## Lint

```bash
npm run lint
```

At the moment, the workspace lint scripts are also placeholders.

## Build

```bash
npm run build
```

This builds both the client and the server workspaces.

## Database notes

- PostgreSQL runs through [docker-compose.yml](docker-compose.yml).
- Prisma schema lives in [server/prisma/schema.prisma](server/prisma/schema.prisma).
- The database stores cases, suspects, weapons, chat logs, discovered weapons, guess attempts, and cooldown state.

## Troubleshooting

- If the server cannot start, check whether port `4001` is already in use.
- If generation or suspect chat fails immediately, verify that `GEMINI_API_KEY` is present in `.env`.
- If the app cannot connect to the database, make sure Docker is running and `npm run db:up` succeeded.
- If Prisma types look stale after schema changes, run `npm run db:generate` again.
- If the client shows API fallback diagnostics, confirm the backend is reachable on `http://localhost:4001`.

## Reference

The canonical product and domain specification is [instructions.prompt.md](instructions.prompt.md). If code, behavior, and documentation disagree, that file is the source of truth.
