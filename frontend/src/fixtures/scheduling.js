// Operations on a fixtures list. Every function is pure: it takes the list and
// returns a NEW list (never edits the old one), so React and the reducer can
// rely on it. Changes that could clash are checked with validation.js first.

import { FIXTURE_STATUS } from "../config/fixtures";
import { validateFixtureSchedule } from "./validation";
import { toMinutes, fromMinutes, addDays, timeToMinutes, datePart } from "./time";
import { blockedInterval } from "./validation";

const EDITABLE = ["homeTeamId", "awayTeamId", "startsAt", "pitchId", "durationMinutes", "breakMinutes"];

// pending -> scheduled once date, time and pitch are all set (and back again).
export function deriveStatus(f) {
  if (f.status === FIXTURE_STATUS.CANCELLED || f.status === FIXTURE_STATUS.COMPLETED) return f.status;
  return f.startsAt && f.pitchId ? FIXTURE_STATUS.SCHEDULED : FIXTURE_STATUS.PENDING;
}

const blank = (v) => v === "" || v === undefined || v === null;
const replace = (fixtures, id, next) => fixtures.map((f) => (f.id === id ? next : f));
const fail = (fixtures, code, message) => ({ ok: false, errors: [{ code, message }], fixtures });

// Edit teams / date / time / pitch / duration / break (this is also "reschedule").
// Returns { ok, errors, fixtures }. When ok is false the list is unchanged.
export function updateFixture(fixtures, id, changes, ctx) {
  const current = fixtures.find((f) => f.id === id);
  if (!current) return fail(fixtures, "NOT_FOUND", "That fixture no longer exists.");
  if (current.status === FIXTURE_STATUS.COMPLETED) {
    return fail(fixtures, "LOCKED", "A completed match cannot be edited.");
  }
  if (current.status === FIXTURE_STATUS.CANCELLED) {
    return fail(fixtures, "LOCKED", "This fixture is cancelled, so it cannot be edited.");
  }

  const clean = {};
  for (const key of EDITABLE) {
    if (!(key in changes)) continue;
    const value = changes[key];
    if (key === "durationMinutes" || key === "breakMinutes") clean[key] = blank(value) ? NaN : Number(value);
    else if (key === "homeTeamId" || key === "awayTeamId") clean[key] = blank(value) ? null : Number(value);
    else clean[key] = blank(value) ? null : value;
  }

  const candidate = { ...current, ...clean };
  candidate.status = deriveStatus(candidate);
  const errors = validateFixtureSchedule(candidate, fixtures, ctx);
  if (errors.length) return { ok: false, errors, fixtures };
  return { ok: true, errors: [], fixtures: replace(fixtures, id, candidate) };
}

export function cancelFixture(fixtures, id) {
  const current = fixtures.find((f) => f.id === id);
  if (!current) return fail(fixtures, "NOT_FOUND", "That fixture no longer exists.");
  if (current.status === FIXTURE_STATUS.COMPLETED) {
    return fail(fixtures, "LOCKED", "A completed match cannot be cancelled.");
  }
  if (current.status === FIXTURE_STATUS.CANCELLED) return { ok: true, errors: [], fixtures };
  const next = { ...current, status: FIXTURE_STATUS.CANCELLED };
  return { ok: true, errors: [], fixtures: replace(fixtures, id, next) };
}

// Called when the match was ended in the Match Centre.
export function completeFixture(fixtures, id, result) {
  return fixtures.map((f) =>
    f.id === id && f.status !== FIXTURE_STATUS.CANCELLED
      ? { ...f, status: FIXTURE_STATUS.COMPLETED, result: { home: result.home, away: result.away } }
      : f
  );
}

// ---------- dashboard ----------

export function fixtureStats(fixtures) {
  const count = (status) => fixtures.filter((f) => f.status === status).length;
  return {
    total: fixtures.length,
    scheduled: count(FIXTURE_STATUS.SCHEDULED),
    completed: count(FIXTURE_STATUS.COMPLETED),
    pending: count(FIXTURE_STATUS.PENDING),
    cancelled: count(FIXTURE_STATUS.CANCELLED),
  };
}

// filters: { roundKey, date, pitchId, status } - an empty value means "any".
export function filterFixtures(fixtures, filters = {}) {
  const { roundKey = "", date = "", pitchId = "", status = "" } = filters;
  return fixtures.filter(
    (f) =>
      (!roundKey || f.roundKey === roundKey) &&
      (!date || datePart(f.startsAt) === date) &&
      (!pitchId || f.pitchId === pitchId) &&
      (!status || f.status === status)
  );
}

export const sortFixtures = (fixtures) =>
  [...fixtures].sort((a, b) => a.roundIndex - b.roundIndex || a.matchNumber - b.matchNumber);

// ---------- auto-schedule ----------

// Gives every PENDING fixture the earliest free slot (date, time and pitch).
// It reuses validateFixtureSchedule, so the result can never contain a clash.
// Knockout matches are only placed after every earlier round has finished, so
// a final is never scheduled before its semi-finals.
// options: { startDate, dayStart: "09:00", dayEnd: "21:00", pitchIds, stepMinutes }
// Returns { fixtures, placed, unplaced: [fixtureId] }.
export function autoSchedule(fixtures, options, ctx) {
  const { startDate, dayStart = "09:00", dayEnd = "21:00", pitchIds, stepMinutes = 5 } = options;
  const pitches = pitchIds?.length ? pitchIds : ctx.pitches.map((p) => p.id);
  const endDate = ctx.tournament?.endDate ?? addDays(startDate, 30);
  const windowStart = timeToMinutes(dayStart);
  const windowEnd = timeToMinutes(dayEnd);

  let working = fixtures;
  const unplaced = [];
  let placed = 0;

  const queue = sortFixtures(fixtures.filter((f) => f.status === FIXTURE_STATUS.PENDING));
  for (const fixture of queue) {
    let found = null;
    const notBefore =
      fixture.stage === "knockout"
        ? Math.max(
            -Infinity,
            ...working
              .filter((f) => f.id !== fixture.id && f.roundIndex < fixture.roundIndex && f.status !== FIXTURE_STATUS.CANCELLED)
              .map((f) => blockedInterval(f)?.playEnd ?? -Infinity)
          )
        : -Infinity;
    for (let date = startDate; date <= endDate && !found; date = addDays(date, 1)) {
      for (let t = windowStart; t + fixture.durationMinutes <= windowEnd && !found; t += stepMinutes) {
        const startsAt = fromMinutes(toMinutes(`${date}T00:00`) + t);
        if (toMinutes(startsAt) < notBefore) continue;
        for (const pitchId of pitches) {
          const candidate = { ...fixture, startsAt, pitchId, status: FIXTURE_STATUS.SCHEDULED };
          if (validateFixtureSchedule(candidate, working, ctx).length === 0) {
            found = candidate;
            break;
          }
        }
      }
    }
    if (found) {
      working = replace(working, fixture.id, found);
      placed += 1;
    } else {
      unplaced.push(fixture.id);
    }
  }
  return { fixtures: working, placed, unplaced };
}
