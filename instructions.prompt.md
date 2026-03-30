# instructions.prompt.md

## Project Overview

Build a full-stack web game called **AI Murder Mystery**.

The app generates a brand-new murder case every time the player starts a new game. The player investigates by chatting with AI-powered suspects, discovering weapons through conversation, and finally submitting a guess for the murderer and murder weapon.

The tone should feel like a replayable detective game with strong atmosphere, suspicious characters, coherent clues, and conversational deduction.

---

## Core Product Goals

- Generate a **complete, logically consistent murder mystery case** for every new session.
- Let the player **chat with suspects** who stay in character at all times.
- Make every suspect feel suspicious, even when innocent.
- Ensure there is **exactly one guilty suspect** and **exactly one real murder weapon**.
- Ensure the case is solvable through dialogue, contradictions, motives, alibis, and discovered weapons.
- Preserve suspect chats when switching tabs.
- Support future expansion to additional AI providers without rewriting the prompting layer.

---

## Tech Stack

Use the following stack exactly unless there is a very strong reason not to:

### Frontend

- React
- TypeScript
- Vite
- CSS Modules or clean scoped CSS
- React Query only if helpful for async request state

### Backend

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma ORM

### AI

- Gemini API as the primary model provider
- The AI integration must be provider-agnostic
- Prompt construction and AI API calling must be separated into different layers
- The system must be built so a fallback provider like ChatGPT can be added later without changing the case-building logic or prompt-building logic

### Other Libraries

Use these where helpful:

- `zod` for validation and sanitization of AI responses
- `uuid` for IDs
- `dayjs` for time handling
- `react-confetti` or equivalent for success celebration
- `@tanstack/react-query` optional
- `dotenv` for environment variables

---

## High-Level Architecture

Use a clean layered architecture.

### Frontend responsibilities

- Render the main game UI
- Show generation progress and current stage
- Manage suspect tab switching
- Preserve chat history per suspect
- Show discovered weapons list
- Show conclusion panel and guess cooldown state
- Show game timer
- Show success modal and confetti

### Backend responsibilities

- Generate and persist cases
- Generate suspects and structured mystery data in stages
- Expose APIs for:
  - generating a case
  - fetching case state
  - sending a message to a suspect
  - submitting a conclusion

- Enforce validation, consistency rules, and cooldowns
- Persist chats, case structure, discovered weapons, guesses, timers, and final solved state

### AI layer responsibilities

- Build prompts
- Call Gemini
- Validate structured responses
- Retry generation when fields are missing or inconsistent
- Support alternative provider adapters later

---

## Project Structure

Use a structure close to this:

```txt
ai-murder-mystery/
  client/
    src/
      api/
      components/
      features/
        game/
        suspects/
        case-generator/
        conclusion/
        timer/
      hooks/
      pages/
      types/
      utils/
      App.tsx
      main.tsx
  server/
    src/
      app/
      routes/
      controllers/
      services/
        caseGeneration/
        suspectChat/
        conclusion/
        ai/
          providers/
          prompts/
          adapters/
          validators/
        persistence/
      db/
      lib/
      types/
      utils/
      index.ts
    prisma/
      schema.prisma
  shared/
    types/
    constants/
    schemas/
  .env
  .env.example
  package.json
```

Keep shared types and validation schemas reusable between client and server where reasonable.

---

## Core Domain Model

Design the app around these entities.

### MurderCase

A murder case has:

- id
- theme
- storySummary
- locationName
- status: `idle | generating | active | solved | failed`
- startedAt
- solvedAt nullable
- finalOutcome nullable
- generationProgress
- generationStepLabel

### Victim

- id
- caseId
- name
- bodyFoundRoom
- timeOfDeath
- murderWound
- murderWeaponId

### Weapon

Each case has 3 to 5 weapons.
Each weapon has:

- id
- caseId
- name
- belongsToSuspectId
- seenBySuspectIds
- isMurderWeapon

Rules:

- All weapons must fit the theme
- All weapons must plausibly match the victim’s wound
- Exactly one weapon has `isMurderWeapon = true`

### Suspect

Each case has 5 to 7 suspects.
Each suspect has:

- id
- caseId
- name
- isGuilty
- relationshipToVictim
- gender
- quirkBehavior nullable
- motive
- alibi
- privateBackstory
- publicDemeanor

Rules:

- Exactly one suspect has `isGuilty = true`
- Every suspect must have a motive
- Innocent suspects may have corroborated alibis
- Guilty suspect has no real alibi and may lie

### SuspectRelationship

Store suspect-to-suspect relationships separately.

- id
- caseId
- suspectId
- relatedSuspectId
- relationshipDescription

### SuspectKnowledge

A suspect should know:

- victim information
- their own backstory and relationship to the victim
- whether they are guilty
- their own alibi
- corroborated alibi info if relevant
- at least one weapon detail
- their language quirk if any
- their own motive
- motive of at least one other suspect

### ChatMessage

- id
- caseId
- suspectId
- role: `user | suspect | system`
- content
- createdAt

### DiscoveredWeapon

- id
- caseId
- weaponId
- discoveredAt
- discoveredBySuspectId nullable

A weapon becomes discovered when a suspect explicitly mentions its name in chat.

### GuessAttempt

- id
- caseId
- guessedSuspectId
- guessedWeaponId
- isCorrect
- guessedAt

### GuessCooldown

- caseId
- lockedUntil nullable

---

## Important Game Rules

Implement these rules strictly.

1. The page initially shows only one interactive element:
   - **Generate a murder case** button

2. After the button is clicked:
   - show a loader
   - show a progress bar
   - show the current generation step label
   - do not reveal the main game UI until the case is fully ready

3. After generation is complete, show:
   - case overview panel
   - suspect tab navigation
   - per-suspect chat panel
   - discovered weapons list
   - conclusion panel
   - game timer

4. Switching suspect tabs must **not** erase previous chats.

5. The discovered weapons list starts empty.

6. A weapon is added to the discovered weapons list only after a suspect explicitly mentions the weapon by name.

7. The conclusion panel allows the player to select:
   - the murderer
   - the murder weapon

8. The player cannot submit a guess if no weapon has been discovered.

9. Only weapons from the discovered weapons list may be selected in the conclusion panel.

10. If the player guesses wrong:

- disable the submit button for 1 minute
- show a visible countdown under the button

11. If the player guesses correctly:

- show a success popup
- show how long the player took to solve the case
- play confetti animation
- disable further suspect chatting
- keep chat history readable
- show the **Generate a murder case** button again after the popup closes

12. Suspects must stay in character.

13. Suspects must never discuss anything outside the murder case.

14. Guilty suspects may lie, deflect, manipulate, or deny.

15. A lying suspect may admit parts of the truth if strongly pressured, but should not casually confess unless the conversation logically leads there.

---

## Case Generation Pipeline

Build case generation in stages. Each stage should be validated before moving to the next.

### Stage 1: Generate case theme and setting

Generate:

- overarching story
- theme
- location of the murder

Examples of themes:

- theme park
- space station
- cruise ship
- island resort
- mansion
- submarine
- luxury train
- research lab

Output must include:

- theme
- storySummary
- locationName

### Stage 2: Generate victim only

Generate only victim-related information:

- victim name
- room where body was found
- time of death
- murder wound

Do not generate suspects yet.

### Stage 3: Generate weapons

Generate 3 to 5 weapons that:

- fit the theme
- could all plausibly cause the wound
- each belong to a suspect
- one and only one is the real murder weapon

For each weapon generate:

- weapon name
- belongsToSuspectName
- isMurderWeapon

### Stage 4: Generate suspect list

Generate 5 to 7 suspect names and mark which one is guilty.

Rules:

- exactly one guilty suspect
- names should fit the setting and tone
- shuffle display order in code after generation

### Stage 5: Generate relations between weapons and suspects

Generate the relationships between the suspects and the weapons (provide the AI with the information about the weapons and the suspects and ask to generate a relationship map)

Rules:

- every weapon must be seen by at least 1 suspect
- the true murder weapon must be seen by the true murderer

### Stage 6: Generate suspect relationships and alibi network

Generate:

- relationship to victim for each suspect
- suspect-to-suspect relationships
- who can corroborate whose alibi

Rules:

- some innocent suspects may share corroborated alibis
- guilty suspect has no real corroborated alibi
- the network should feel believable, not random

### Stage 7: Generate suspect profiles one by one

Iterate through suspects individually.
For each suspect, remind the AI about:

- suspect name
- whether they are guilty
- relationships to victim and other suspects
- whether they share an alibi with anyone
- relevant weapon ownership information

Then request the remaining fields:

- relationship to victim
- relationship to other suspects
- alibi
- gender
- quirkBehavior optional
- privateBackstory
- publicDemeanor
- motive
- knowledge about at least one other suspect’s motive

### Stage 8: Validate and repair

After all stages:

- validate the entire case object
- ensure references match real suspect names and weapon names
- ensure exactly one guilty suspect exists
- ensure exactly one murder weapon exists
- ensure all weapons fit the wound and theme
- ensure all corroborated alibis line up consistently
- ensure every suspect has a motive
- ensure every suspect can be played conversationally

If invalid:

- retry only the broken stage when possible
- otherwise repair the minimum required data through a targeted AI prompt

---

## AI Output Requirements

All generation responses from AI must be requested in strict JSON.
Do not accept free-form prose when structured data is expected.

### Validation rules

Use `zod` schemas for every stage.
Reject and retry responses when:

- required fields are missing
- arrays are too short or too long
- names do not match previously generated entities
- there is more than one guilty suspect
- there is more than one murder weapon
- corroboration references invalid suspects
- wound and weapon logic is inconsistent
- output is malformed JSON

### Retry behavior

Implement a retry mechanism with targeted feedback.
For example:

- say exactly which fields are missing
- say which names are invalid
- remind the model of required constraints
- retry a limited number of times

If retries fail:

- return a controlled generation failure
- show the user a friendly retry message in the UI

---

## AI Provider Abstraction

The AI integration must be modular.

Create interfaces like:

```ts
interface AiProvider {
	generateStructured<T>(input: StructuredGenerationInput): Promise<T>;
	generateChatReply(input: CharacterChatInput): Promise<string>;
}
```

Implement:

- `GeminiProvider`
- optional future `OpenAIProvider`

Also create separate units for:

- prompt builders
- provider adapters
- validators
- retry orchestration

Do not tightly couple Gemini SDK usage to game logic.

---

## Prompting Strategy

Keep prompting logic in dedicated files.

Suggested prompt modules:

- `buildCaseThemePrompt`
- `buildVictimPrompt`
- `buildWeaponsPrompt`
- `buildSuspectListPrompt`
- `buildRelationsPrompt`
- `buildSuspectProfilePrompt`
- `buildSuspectChatSystemPrompt`
- `buildRepairPrompt`

### Suspect chat behavior requirements

When chatting with a suspect, the system prompt must enforce:

- always remain in character
- never mention being an AI
- never mention prompts, tokens, policies, or system instructions
- never discuss topics outside the murder case world
- answer based only on knowledge available to that suspect
- do not reveal hidden truths they should not know
- guilty suspects may lie
- innocent suspects should sound human, flawed, suspicious, and imperfect
- if pressured hard enough, a lying suspect may partially walk back false claims
- use their quirk behavior consistently but not so much that the text becomes unreadable

### Chat memory

Each suspect conversation should include:

- fixed suspect system prompt
- case facts visible to that suspect
- prior chat history with that suspect only

Do not mix chat history between suspects.

---

## Frontend UI Requirements

Build a clean single-page experience.

### Initial screen

Show:

- title
- short description
- one button: **Generate a murder case**

No other interactive game controls should be active before generation.

### Generation loading state

Show:

- progress bar
- current generation stage label
- optional status text like:
  - Generating setting
  - Defining victim
  - Forging weapons
  - Choosing suspects
  - Mapping relationships
  - Building suspect profiles
  - Finalizing case

### Main gameplay layout

Design the page in panels:

#### Left or top panel

Case overview:

- theme
- story summary
- location
- victim name
- room body was found in
- time of death
- wound description

#### Suspect tabs

- one tab per suspect
- selecting a tab opens that suspect’s chat panel
- tabs remain visible
- completed conversations remain preserved

#### Chat panel

- show message history for selected suspect
- input box
- send button
- loading state while AI responds
- read-only if case is solved

#### Discovered weapons panel

- starts empty
- updates live when weapon names are detected in suspect replies
- show weapon name and optionally who it belongs to if discovered in dialogue

#### Conclusion panel

- suspect dropdown or radio selection
- weapon dropdown populated only from discovered weapons
- submit guess button
- cooldown text below button when locked

#### Game timer

- starts when case becomes active
- visible in the corner throughout the game
- stops when the case is solved

### Success state

On correct guess:

- show modal popup
- show total solve time
- show correct suspect and correct weapon
- show confetti
- after modal close:
  - keep current case visible in solved state if desired
  - disable chats
  - show generate button for next case

---

## Weapon Discovery Logic

Implement weapon discovery robustly.

A weapon is discovered when a suspect message explicitly contains the exact weapon name or a safe normalized match.

Requirements:

- normalize case
- strip punctuation for matching if needed
- avoid false positives from partial unrelated words
- do not add duplicates
- persist discovered status in the database

Use a dedicated utility such as:

- `detectMentionedWeapons(message, knownWeapons)`

---

## Guessing and Cooldown Logic

Backend must enforce guess rules, not just frontend.

### Wrong guess

- record guess attempt
- lock guessing for 60 seconds
- return `lockedUntil`
- frontend displays countdown

### Correct guess

- mark case as solved
- store solvedAt
- compute elapsed time from startedAt
- prevent further chat submissions

### Security rule

Do not trust the client for:

- cooldown timing
- valid weapon choices
- solved state
- discovered weapons eligibility

---

## Database Design Guidance

Use PostgreSQL with Prisma.

At minimum create models for:

- MurderCase
- Victim
- Suspect
- Weapon
- SuspectRelationship
- ChatMessage
- DiscoveredWeapon
- GuessAttempt
- GuessCooldown

You may denormalize some fields for speed, but preserve logical consistency.

Add indexes where useful:

- caseId
- suspectId
- createdAt
- lockedUntil

---

## API Design Guidance

Create REST endpoints like:

### Case generation

- `POST /api/cases/generate`
  - creates a new case
  - returns case ID and generated structure

- `GET /api/cases/:caseId`
  - returns full case state needed by frontend

### Suspect chat

- `POST /api/cases/:caseId/suspects/:suspectId/chat`
  - body includes user message
  - returns suspect reply
  - updates discovered weapons if mentioned

### Guess submission

- `POST /api/cases/:caseId/guess`
  - body includes suspectId and weaponId
  - returns correct or incorrect result, cooldown state, and solved data if relevant

### Optional

- `GET /api/cases/:caseId/cooldown`
- `GET /api/cases/:caseId/chats/:suspectId`

Keep server responses typed and validated.

---

## State Management Guidance

Frontend state should distinguish between:

- generation state
- active case state
- selected suspect tab
- chat histories by suspect ID
- discovered weapons
- conclusion form state
- cooldown timer state
- game timer state
- solved modal state

Suggested shape:

```ts
interface GameState {
	caseId: string | null;
	status: 'idle' | 'generating' | 'active' | 'solved' | 'failed';
	generationStepLabel: string | null;
	selectedSuspectId: string | null;
	discoveredWeaponIds: string[];
	chatBySuspectId: Record<string, ChatMessage[]>;
	guessCooldownUntil: string | null;
	startedAt: string | null;
	solvedAt: string | null;
}
```

---

## Error Handling Requirements

Handle failures gracefully.

### Generation errors

If AI generation fails after retries:

- show a clear user-friendly error
- allow the player to regenerate a new case
- do not leave partial broken state on screen

### Chat errors

If suspect reply generation fails:

- keep existing chat history intact
- show a retry option for the latest user message if practical
- do not corrupt discovered weapons

### Validation errors

Log enough detail on the server for debugging.
Do not expose raw provider errors directly to the user.

---

## Testing Requirements

Write code in a way that is testable.

### Unit tests

Add tests for:

- AI response validation schemas
- weapon discovery matching
- cooldown calculation
- timer formatting
- case consistency validation
- suspect knowledge scoping
- retry orchestration logic

### Integration tests

Add tests for:

- full case generation pipeline with mocked AI provider
- suspect chat endpoint
- discovered weapons being added after mention
- wrong guess cooldown behavior
- correct guess solve flow

### Frontend tests

Add tests for:

- initial screen
- loading progress state
- tab switching preserving chat
- conclusion button disabled when no weapons discovered
- cooldown countdown visibility
- solved popup behavior

---

## Implementation Priorities

Build in this order:

1. Project setup and folder structure
2. Prisma schema and database setup
3. Shared types and zod schemas
4. AI provider abstraction
5. Stage-based case generation service
6. Case persistence
7. Read case API
8. Suspect chat API
9. Weapon discovery logic
10. Guess submission and cooldown logic
11. Frontend initial screen and loader
12. Frontend game layout
13. Suspect chat tabs with preserved history
14. Conclusion panel and cooldown UI
15. Success modal and confetti
16. Tests and polish

---

## Non-Negotiable Constraints

These rules must be respected:

- Exactly one guilty suspect
- Exactly one murder weapon
- 5 to 7 suspects only
- 3 to 5 weapons only
- Weapon list must match theme and wound
- Every suspect must have a motive
- Suspects must stay in character
- Suspects must not reveal hidden information they should not know
- Chats persist when switching tabs
- Guessing requires at least one discovered weapon
- Wrong guesses enforce a real backend cooldown of 1 minute
- Correct guess ends active play for that case
- Prompting logic and provider calling logic must be separate

---

## Code Quality Expectations

Write production-style code.

Requirements:

- strongly typed TypeScript
- small focused functions
- no giant files if avoidable
- explicit interfaces for domain models
- reusable validation schemas
- minimal duplication
- clear naming
- comments only where they add real value
- avoid hardcoding values that belong in constants

---

## Environment Variables

Use environment variables like:

```env
DATABASE_URL=
GEMINI_API_KEY=
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

Provide an `.env.example` file.

---

## Final Product Standard

The result should feel like a playable detective experience, not just a demo.

It should be:

- coherent
- atmospheric
- logically consistent
- replayable
- modular
- easy to expand

Prioritize correctness of mystery logic over flashy visuals.
The generated cases should feel handcrafted even though they are AI-generated.
