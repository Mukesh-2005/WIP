# Changelog

## 2026-11-16
- Created project structure: backend/, frontend/, docs/
- Backend: FastAPI app with GET /api/v1/health and CORS for localhost:5173
- Frontend: Vite + React; App.jsx calls the health endpoint to test the connection
- Added .gitignore, backend/.env.example and frontend/.env.example
- Not done yet: database, authentication, tournament modules

- Created Figma UI mock (5 screens) from the requirements document: public tournament page, organizer dashboard, team registration, fixture manager, mobile match centre

## 2026-11-17 - Match Centre module (frontend, mock data)
- Added Match Centre UI in frontend/src (React, JavaScript), using mock data only. No backend calls yet.
- Scoreboard: team names, logos (initials badge fallback), live score, match clock, status pill.
- Timer: Start, Pause, Resume, End match, New match (reset). Hook: hooks/useMatchTimer.js.
- Events: Goal, Own Goal, Yellow Card, Red Card, Substitution (player out + player in). Player picked from the chosen team.
- State: events live in a reducer (state/matchReducer.js). Score and on-pitch squad are derived from the events, never stored.
- Timeline with mm:ss timestamps and an "Undo last event" button.
- Confirmation dialog before ending a match; full-time summary after it (result, goals, cards, substitutions).
- Substituted-off and sent-off (red card) players cannot be selected again; a bench player can come on once.
- Responsive layout: one column on phones, two columns from 768px. Added an error boundary so a crash shows a message, not a blank page.
- Components: ScoreBoard, TeamLogo, TimerControls, EventForm, Timeline, ConfirmModal, FullTimeSummary, ErrorBoundary.
- Open questions for Suraj: sport (football/futsal or cricket)? players per side and minimum players to continue? substitution rules after a red card? timeline order (newest first or oldest first)?
- Not done: backend integration, saving matches, login/roles, automated tests.


## 2026-11-18 - Match Centre: rules, persistence and tests (after Suraj's feedback)
- Decisions applied: football/futsal only for V1 (sport-flexible structure), initials badge for logos.
- Tournament rules are now data, not hardcoded (config/rules.js): playersPerSide (5, 6, 7, 11), minPlayersToContinue, redCardReplacement ("none" by default, or "immediate"). Rules are validated and shown under the tournament name.
- Event types live in a sport registry (config/sports.js). Adding a sport = adding an entry; the score, squad and timeline read from it.
- Minimum players: a team below the minimum is flagged with a banner, the clock stops automatically, and Start/Resume are disabled until it is resolved (e.g. undo a mistaken event). The organiser can still end the match. No automatic forfeit.
- Red-card replacement: default is no replacement. With "immediate", a "Replacement" event appears for a team with a sent-off player, once per red card.
- Match data is structured for the backend: events now use `side` ("home"/"away"), `sequence`, `createdAt`, `voidedAt`. Undo marks the event as voided instead of deleting it, so history is complete.
- Persistence: services/matchRepository.js (async; browser storage now, FastAPI later) saves the in-progress match (restored after refresh, a running match comes back paused) and archives finished matches. Match history list added to the screen.
- Added automated tests (Vitest + jsdom): 65 tests for score, undo, squad, rules, formats, persistence and the full UI workflow. Run with `npm test` in frontend/.
- Open: players-per-side/minimum/red-card values are set in data/mockMatch.js for now; the organiser-facing editor belongs to the tournament setup module. minPlayersToContinue = 3 is a placeholder default.
- Not pushed: waiting for Suraj to share repository access.
