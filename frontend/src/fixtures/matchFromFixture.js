// Turns a fixture into the `match` object the Match Centre expects, so the
// match opens with the right teams, tournament and scheduled information.

import { FIXTURE_STATUS, TEAM_APPROVAL } from "../config/fixtures";
import { formatDate, formatTimeRange } from "./time";

// One line shown under the tournament name, e.g.
// "Knockout · Final · Fri, 20 Nov 2026 · 10:00–10:40 · Pitch A"
export function scheduleLine(schedule) {
  if (!schedule) return "";
  return [
    schedule.roundLabel,
    schedule.matchLabel,
    formatDate(schedule.startsAt),
    formatTimeRange(schedule.startsAt, schedule.durationMinutes),
    schedule.pitchName,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Why a fixture cannot be opened yet (or null when it can). Used for the button's tooltip.
export function openMatchBlocker(fixture, teams) {
  if (fixture.status === FIXTURE_STATUS.CANCELLED) return "This fixture is cancelled.";
  if (fixture.homeTeamId == null || fixture.awayTeamId == null) return "Both teams must be assigned first.";
  const unapproved = [fixture.homeTeamId, fixture.awayTeamId].some(
    (id) => teams.find((t) => t.id === id)?.approvalStatus !== TEAM_APPROVAL.APPROVED
  );
  if (unapproved) return "Both teams must be approved.";
  if (fixture.status === FIXTURE_STATUS.PENDING) return "Set the date, time and pitch first.";
  return null;
}

// Returns { ok: true, match } or { ok: false, reason }.
export function buildMatchFromFixture(fixture, { tournament, teams, pitches }) {
  const reason = openMatchBlocker(fixture, teams);
  if (reason) return { ok: false, reason };

  const home = teams.find((t) => t.id === fixture.homeTeamId);
  const away = teams.find((t) => t.id === fixture.awayTeamId);
  const pitch = pitches.find((p) => p.id === fixture.pitchId);

  return {
    ok: true,
    match: {
      id: fixture.id,
      fixtureId: fixture.id, // lets the Match Centre save this match under the fixture's id
      tournament: {
        id: tournament.id,
        name: tournament.name,
        sport: tournament.sport,
        rules: tournament.rules,
      },
      teams: { home, away },
      schedule: {
        roundLabel: fixture.roundLabel,
        matchLabel: fixture.matchLabel,
        startsAt: fixture.startsAt,
        durationMinutes: fixture.durationMinutes,
        pitchName: pitch?.name ?? "",
      },
    },
  };
}
