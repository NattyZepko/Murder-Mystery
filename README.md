# AI Murder Mystery

AI Murder Mystery is a full-stack detective game. Each new case is generated on the server, persisted in PostgreSQL, and played through a React client where the player interviews suspects, uncovers weapon clues, and submits a final accusation.

The repository is a monorepo with a React frontend, an Express API, Prisma for persistence, PostgreSQL for storage, and a provider-agnostic AI layer currently backed by Gemini.

## How the project works

At a high level, the game loop is:

1. The client requests a new case.
2. The server creates a case skeleton immediately and generates the full mystery in background stages.
3. The client polls the case state and shows generation progress until the case becomes active.
4. The player chats with suspects. Chat history is stored per suspect and newly discovered weapons are unlocked from conversation.
5. The player submits a suspect and weapon guess.
6. The server validates the conclusion, enforces cooldowns, and marks the case solved when correct.

The backend enforces the core game invariants:

- exactly one guilty suspect
- exactly one true murder weapon
- 5 to 7 suspects per case
- 3 to 5 weapons per case
- logically consistent motives, alibis, and weapon visibility

## Repository structure

- `client/`: React + TypeScript + Vite application
- `server/`: Express + TypeScript API, Prisma schema, AI generation pipeline
- `shared/`: shared types, schemas, and constants used across the monorepo
- `.env.example`: local environment template for both client and server
- `instructions.prompt.md`: canonical product and domain specification

## Runtime architecture

### Client

The client is a Vite app that renders the game UI, generation progress, suspect chat panels, timer, discovered weapons, and conclusion flow.

During development, Vite proxies `/api` requests to the backend. The client can also use `VITE_API_BASE_URL` if you want it to target a specific backend URL directly.

### Server

The server exposes these main HTTP endpoints:

- `POST /api/cases/generate`: create a new case
- `GET /api/cases/:caseId`: fetch current case state
- `POST /api/cases/:caseId/suspects/:suspectId/chat`: send a chat message to a suspect
- `POST /api/cases/:caseId/guess`: submit a final conclusion
- `GET /api/cases/:caseId/cooldown`: fetch the current guess cooldown state
- `GET /api/health`: health check

Case generation is performed in staged AI calls so the server can track progress and fall back deterministically when a stage fails or times out.

### Database

PostgreSQL stores cases, suspects, weapons, suspect relationships, discovered weapons, chat logs, guesses, and cooldown state. Prisma is used for schema management and database access.

## Prerequisites

Install these before starting the project:

- Node.js 20+
- npm
- Docker Desktop or another Docker-compatible runtime
- A Gemini API key

## Environment setup

Create a root `.env` file based on `.env.example`.

Example values:

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

Notes:

- `PORT` controls the Express server port. The current default is `4001`.
- `VITE_API_BASE_URL` is optional in development if you rely on the Vite proxy, but keeping it set to `http://localhost:4001` is fine.
- `GEMINI_API_KEY` is required for case generation and suspect chat.

## Installation

From the repository root:

```bash
npm install
```

## Database startup

Start PostgreSQL with Docker:

```bash
npm run db:up
```

Generate the Prisma client:

```bash
npm run db:generate
```

Apply database migrations:

```bash
npm run db:migrate
```

If you want to inspect database logs:

```bash
npm run db:logs
```

To stop the database container later:

```bash
npm run db:down
```

## Launching the app

Once dependencies are installed, the database is running, migrations are applied, and `.env` is configured, launch the app in two terminals from the repository root.

Start the backend:

```bash
npm run dev:server
```

Start the frontend:

```bash
npm run dev:client
```

Expected local URLs:

- frontend: `http://localhost:5173`
- backend: `http://localhost:4001`

The Vite dev server proxies frontend `/api` requests to the Express backend on port `4001`.

## Build and workspace scripts

Run both production builds:

```bash
npm run build
```

Useful root scripts:

- `npm run dev`: starts the server workspace dev script
- `npm run dev:server`: starts the Express server in watch mode
- `npm run dev:client`: starts the Vite client
- `npm run build`: builds client and server
- `npm run test`: runs workspace test scripts
- `npm run lint`: runs workspace lint scripts
- `npm run db:up`: starts PostgreSQL with Docker Compose
- `npm run db:down`: stops PostgreSQL
- `npm run db:generate`: runs Prisma client generation
- `npm run db:migrate`: runs Prisma development migrations

## Current stack

- Frontend: React, TypeScript, Vite, React Query, CSS Modules
- Backend: Node.js, Express, TypeScript
- Persistence: PostgreSQL, Prisma
- AI: Gemini via a provider-agnostic adapter layer
- Validation: Zod

## Troubleshooting

- If the server fails to start because the port is already in use, stop the old process that is still listening on port `4001`.
- If case generation or suspect chat fails immediately, verify that `GEMINI_API_KEY` is set in `.env`.
- If the server cannot connect to PostgreSQL, make sure Docker is running and `npm run db:up` completed successfully.
- If Prisma types look stale after schema changes, run `npm run db:generate` again.

## Reference

The product specification and domain rules live in `instructions.prompt.md`. If implementation details and documentation disagree, treat that file as the source of truth.
