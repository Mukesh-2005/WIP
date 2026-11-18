import { calculateScore } from "./matchReducer";

// The full, persistable description of one match. This is the object we save
// now (browser storage) and will send to / load from the FastAPI backend later.
export function buildMatchRecord({ matchId, match, status, clockSeconds, startedAt, endedAt, events }) {
  const { teams, tournament } = match;
  return {
    id: matchId,
    tournamentId: tournament.id,
    sport: tournament.sport,
    rules: tournament.rules,
    homeTeam: { id: teams.home.id, name: teams.home.name },
    awayTeam: { id: teams.away.id, name: teams.away.name },
    status,
    clockSeconds,
    startedAt,
    endedAt,
    events,
    score: calculateScore(events, tournament.sport),
    updatedAt: new Date().toISOString(),
  };
}

// A match that was "running" when the page closed cannot still be ticking,
// so it comes back paused and the organiser decides when to resume.
export function restoreStatus(status) {
  return status === "running" ? "paused" : status;
}
