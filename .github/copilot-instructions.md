# Project Guidelines

## Source Of Truth

- Treat `instructions.prompt.md` as the canonical product and domain specification for this repository.
- If implementation details conflict with `instructions.prompt.md`, update code to match the spec.

## Architecture

- Build this project as a monorepo with `client/`, `server/`, and `shared/` directories.
- Keep backend concerns layered: routes call controllers, controllers call services, and services handle domain rules and persistence.
- Keep AI prompt construction separate from provider API calling so model providers can be swapped without rewriting generation logic.
- Put reusable types and schemas in `shared/` when they are used by both client and server.

## AI Integration Rules

- Use Gemini as the primary provider, but keep a provider-agnostic interface for future adapters.
- Require strict JSON-shaped AI outputs validated with `zod` before using them.
- Add explicit timeouts to AI calls and retry on malformed or incomplete responses.
- Do not stop generation on one malformed AI response when deterministic fallback data can safely continue the pipeline.

## Domain Invariants

- Every case must have exactly one guilty suspect.
- Every case must have exactly one true murder weapon.
- Case generation must remain logically consistent across motives, alibis, suspect knowledge, and discovered weapons.
- Enforce game rules on the server; do not trust client-side checks for conclusions, cooldowns, or solved state.

## Frontend Conventions

- Preserve per-suspect chat history while switching suspect tabs.
- Keep case generation progress visible to the player during multi-stage generation.
- Keep UI logic separate from domain calculations where practical.

## Build And Test

- Prefer workspace scripts at the root and app-specific scripts in `client/` and `server/`.
- When scripts are added, keep script names conventional (`dev`, `build`, `test`, `lint`) and document them in `README.md`.
- For backend and domain tests, mock AI providers to make tests deterministic.

## Key Reference

- Read `instructions.prompt.md` before major feature work; it contains required entities, flows, constraints, and acceptance criteria.
