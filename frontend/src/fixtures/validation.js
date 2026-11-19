// Scheduling rules. Pure functions (no React, no storage) so they can be
// reused by the UI, the auto-scheduler, publishing and the tests.
//
// Every function returns a list of problems: [{ code, message, otherId? }].
// An empty list means "valid".
//
// Time model (assumption, see CHANGELOG):
//   a match blocks its pitch AND both of its teams from its start until
//   start + duration + break. Two fixtures conflict when those blocks overlap.

import { FIXTURE_STATUS, TEAM_APPROVAL, LIMITS } from "../config/fixtures";
import { toMinutes, formatDate, formatTimeRange } from "./time";

export const ERROR = {
  SAME_TEAM: "SAME_TEAM",
  TEAM_NOT_APPROVED: "TEAM_NOT_APPROVED",
  DUPLICATE_FIXTURE: "DUPLICATE_FIXTURE",
  INVALID_DATE: "INVALID_DATE",
  INVALID_DURATION: "INVALID_DURATION",
  UNKNOWN_PITCH: "UNKNOWN_PITCH",
  PITCH_CONFLICT: "PITCH_CONFLICT",
  TEAM_CONFLICT: "TEAM_CONFLICT",
};

const isWholeNumber = (n) => Number.isInteger(n);

export function validateDurations({ durationMinutes, breakMinutes }) {
  const errors = [];
  if (!isWholeNumber(durationMinutes) || durationMinutes < 1 || durationMinutes > LIMITS.maxDurationMinutes) {
    errors.push({
      code: ERROR.INVALID_DURATION,
      message: `Match duration must be a whole number between 1 and ${LIMITS.maxDurationMinutes} minutes.`,
    });
  }
  if (!isWholeNumber(breakMinutes) || breakMinutes < 0 || breakMinutes > LIMITS.maxBreakMinutes) {
    errors.push({
      code: ERROR.INVALID_DURATION,
      message: `Break time must be a whole number between 0 and ${LIMITS.maxBreakMinutes} minutes.`,
    });
  }
  return errors;
}

// The time a fixture occupies: [start, end) where end includes the break.
export function blockedInterval(f) {
  const start = toMinutes(f.startsAt);
  if (start === null || !isWholeNumber(f.durationMinutes)) return null;
  const breakMinutes = isWholeNumber(f.breakMinutes) ? f.breakMinutes : 0;
  return { start, playEnd: start + f.durationMinutes, end: start + f.durationMinutes + breakMinutes };
}

export const intervalsOverlap = (a, b) => a.start < b.end && b.start < a.end;

const isActive = (f) => f.status !== FIXTURE_STATUS.CANCELLED;
const hasTeam = (f, id) => f.homeTeamId === id || f.awayTeamId === id;
const samePair = (a, b) =>
  (a.homeTeamId === b.homeTeamId && a.awayTeamId === b.awayTeamId) ||
  (a.homeTeamId === b.awayTeamId && a.awayTeamId === b.homeTeamId);

// "Green Hawks vs Blue Sharks", or the placeholder ("Winner of Semi-final 1 vs TBD").
export function fixtureTitle(f, teams = []) {
  const side = (teamId, label) =>
    teamId != null ? (teams.find((t) => t.id === teamId)?.name ?? `Team ${teamId}`) : (label ?? "TBD");
  return `${side(f.homeTeamId, f.homeLabel)} vs ${side(f.awayTeamId, f.awayLabel)}`;
}

// Checks ONE fixture (`candidate`) against all the others.
//   ctx = { teams, pitches }
export function validateFixtureSchedule(candidate, fixtures, ctx) {
  const { teams = [], pitches = [] } = ctx;
  const errors = [];
  const add = (code, message, extra = {}) => errors.push({ code, message, ...extra });
  const teamName = (id) => teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  const others = fixtures.filter((f) => f.id !== candidate.id && isActive(f));
  const { homeTeamId: home, awayTeamId: away } = candidate;

  // ---- teams ----
  for (const id of [home, away]) {
    if (id == null) continue;
    const team = teams.find((t) => t.id === id);
    if (!team || team.approvalStatus !== TEAM_APPROVAL.APPROVED) {
      add(ERROR.TEAM_NOT_APPROVED, `${teamName(id)} is not an approved team, so it cannot be scheduled.`);
    }
  }
  if (home != null && home === away) {
    add(ERROR.SAME_TEAM, "A team cannot play against itself. Choose two different teams.");
  }
  if (home != null && away != null && home !== away) {
    const dup = others.find(
      (f) =>
        f.stage === candidate.stage &&
        f.homeTeamId != null &&
        f.awayTeamId != null &&
        samePair(f, candidate)
    );
    if (dup) {
      add(
        ERROR.DUPLICATE_FIXTURE,
        `${teamName(home)} vs ${teamName(away)} already exists (${dup.roundLabel}). A pairing can only appear once.`,
        { otherId: dup.id }
      );
    }
  }

  // ---- durations, pitch, date ----
  const durationErrors = validateDurations(candidate);
  errors.push(...durationErrors);

  const hasPitch = candidate.pitchId != null && candidate.pitchId !== "";
  if (hasPitch && !pitches.some((p) => p.id === candidate.pitchId)) {
    add(ERROR.UNKNOWN_PITCH, "The selected pitch does not exist.");
  }
  const pitchName = (id) => pitches.find((p) => p.id === id)?.name ?? id;

  const hasTime = candidate.startsAt != null && candidate.startsAt !== "";
  const interval = hasTime ? blockedInterval(candidate) : null;
  if (hasTime && toMinutes(candidate.startsAt) === null) {
    add(ERROR.INVALID_DATE, "Enter a valid date and time.");
  }
  // ---- clashes with other fixtures ----
  if (interval && durationErrors.length === 0) {
    const when = (f) => `${formatDate(f.startsAt)}, ${formatTimeRange(f.startsAt, f.durationMinutes)}`;
    for (const other of others) {
      const otherInterval = blockedInterval(other);
      if (!otherInterval || !intervalsOverlap(interval, otherInterval)) continue;

      if (hasPitch && other.pitchId === candidate.pitchId) {
        add(
          ERROR.PITCH_CONFLICT,
          `${pitchName(candidate.pitchId)} is already booked for ${fixtureTitle(other, teams)} (${when(other)}, plus a ${other.breakMinutes}-minute break). Choose another pitch or time.`,
          { otherId: other.id }
        );
      }
      for (const id of [home, away]) {
        if (id != null && hasTeam(other, id)) {
          add(
            ERROR.TEAM_CONFLICT,
            `${teamName(id)} is already playing in ${fixtureTitle(other, teams)} (${when(other)}). A team cannot be in two matches at the same time, breaks included.`,
            { otherId: other.id }
          );
        }
      }
    }
  }

  return errors;
}

// Checks every active fixture (used before publishing). Each clash is reported once.
export function validateAllFixtures(fixtures, ctx) {
  const seen = new Set();
  const problems = [];
  for (const f of fixtures) {
    if (!isActive(f)) continue;
    for (const err of validateFixtureSchedule(f, fixtures, ctx)) {
      const key = `${err.code}:${[f.id, err.otherId ?? ""].sort().join("|")}:${err.otherId ? "" : err.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      problems.push({ ...err, fixtureId: f.id });
    }
  }
  return problems;
}
