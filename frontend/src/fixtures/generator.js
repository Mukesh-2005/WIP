// Automatic fixture generation. Pure functions: teams in, fixtures out.
// No React, no storage, no dates (scheduling is a separate step).
//
// A generated fixture looks like:
//   { id, stage, round, roundKey, roundLabel, roundIndex, matchNumber, matchLabel,
//     homeTeamId, awayTeamId, homeFrom, awayFrom, homeLabel, awayLabel,
//     startsAt: null, pitchId: null, durationMinutes, breakMinutes, status, result }
//
// A side that is not known yet (e.g. "Winner of Semi-final 1") has teamId = null,
// a `from` description and a human `label`.

import { FIXTURE_FORMATS, FIXTURE_STATUS, TEAM_APPROVAL, DEFAULT_SCHEDULE } from "../config/fixtures";
import { validateDurations } from "./validation";

export class FixtureGenerationError extends Error {}

// ---------- teams ----------

// Only registered AND approved teams take part. Duplicate ids are ignored.
export function getEligibleTeams(teams = []) {
  const seen = new Set();
  return teams.filter((t) => {
    if (t.approvalStatus !== TEAM_APPROVAL.APPROVED || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

export const defaultQualifiers = (teamCount) => Math.max(2, 2 ** Math.floor(Math.log2(teamCount)));

const ordinal = (n) => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `${n}${suffix}`;
};

function makeFixture({ id, stage, round, roundLabel, roundIndex, matchNumber, matchLabel, home, away, schedule }) {
  return {
    id,
    stage,
    round,
    roundKey: `${stage}-${round}`,
    roundLabel,
    roundIndex,
    matchNumber,
    matchLabel,
    homeTeamId: home.teamId ?? null,
    awayTeamId: away.teamId ?? null,
    homeFrom: home.from ?? null,
    awayFrom: away.from ?? null,
    homeLabel: home.label ?? null,
    awayLabel: away.label ?? null,
    startsAt: null,
    pitchId: null,
    durationMinutes: schedule.durationMinutes,
    breakMinutes: schedule.breakMinutes,
    status: FIXTURE_STATUS.PENDING,
    result: null,
  };
}

// ---------- league (round robin) ----------

// "Circle method": one team stays fixed, the others rotate each round. With an
// odd number of teams a "bye" slot (null) is added, so one team rests per round.
// Returns [{ matches: [[home, away], ...], byes: [teamId] }].
export function roundRobinRounds(teamIds) {
  const arr = [...teamIds];
  if (arr.length % 2 === 1) arr.push(null);
  const size = arr.length;
  const rounds = [];
  for (let r = 0; r < size - 1; r++) {
    const matches = [];
    const byes = [];
    for (let i = 0; i < size / 2; i++) {
      const a = arr[i];
      const b = arr[size - 1 - i];
      if (a === null || b === null) {
        byes.push(a ?? b);
        continue;
      }
      matches.push((r + i) % 2 === 0 ? [a, b] : [b, a]); // alternate home/away
    }
    rounds.push({ matches, byes });
    arr.splice(1, 0, arr.pop()); // rotate everything except the first team
  }
  return rounds;
}

export function generateLeague(teamIds, { schedule }) {
  const base = roundRobinRounds(teamIds);
  const fixtures = [];
  const byes = [];
  base.forEach((round, index) => {
    const number = index + 1;
    const roundLabel = `League · Round ${number}`;
    round.matches.forEach(([home, away], m) => {
      fixtures.push(
        makeFixture({
          id: `LG-R${number}-M${m + 1}`,
          stage: "league",
          round: number,
          roundLabel,
          roundIndex: number,
          matchNumber: m + 1,
          matchLabel: `Match ${m + 1}`,
          home: { teamId: home },
          away: { teamId: away },
          schedule,
        })
      );
    });
    round.byes.forEach((teamId) => byes.push({ roundKey: `league-${number}`, roundLabel, teamId, label: null }));
  });
  return { fixtures, byes, rounds: base.length };
}

// ---------- knockout ----------

// Standard bracket order so strong seeds meet late: size 8 -> [1,8,4,5,2,7,3,6].
export function seedOrder(size) {
  let order = [1];
  for (let len = 1; len < size; len *= 2) {
    order = order.flatMap((seed) => [seed, 2 * len + 1 - seed]);
  }
  return order;
}

const roundName = (fromEnd) =>
  fromEnd === 0 ? "Final" : fromEnd === 1 ? "Semi-finals" : fromEnd === 2 ? "Quarter-finals" : `Round of ${2 ** (fromEnd + 1)}`;
const matchName = (fromEnd, number) =>
  fromEnd === 0 ? "Final" : fromEnd === 1 ? `Semi-final ${number}` : fromEnd === 2 ? `Quarter-final ${number}` : `Round of ${2 ** (fromEnd + 1)} · Match ${number}`;

// `entrants` are in seed order: { teamId } or { from: {type:"league_position", position}, label }.
// If the count is not a power of two, the top seeds get a bye into round 2.
export function generateKnockout(entrants, { idPrefix = "KO", roundIndexOffset = 0, schedule }) {
  const count = entrants.length;
  const size = 2 ** Math.ceil(Math.log2(count));
  const totalRounds = Math.log2(size);

  // null = bye slot (seed number larger than the number of entrants)
  let current = seedOrder(size).map((seed) => (seed <= count ? { kind: "entrant", entrant: entrants[seed - 1] } : null));
  const fixtures = [];
  const byes = [];

  const sideOf = (node) =>
    node.kind === "entrant"
      ? { teamId: node.entrant.teamId ?? null, from: node.entrant.from ?? null, label: node.entrant.label ?? null }
      : { teamId: null, from: { type: "winner", fixtureId: node.fixtureId }, label: `Winner of ${node.matchLabel}` };

  for (let round = 1; round <= totalRounds; round++) {
    const fromEnd = totalRounds - round;
    const roundLabel = `Knockout · ${roundName(fromEnd)}`;
    const next = [];
    let matchNumber = 0;

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1];
      if (left === null || right === null) {
        const advancing = left ?? right; // walkover into the next round
        next.push(advancing);
        const side = sideOf(advancing);
        byes.push({ roundKey: `knockout-${round}`, roundLabel, teamId: side.teamId, label: side.label });
        continue;
      }
      matchNumber += 1;
      const id = `${idPrefix}-R${round}-M${matchNumber}`;
      const home = sideOf(left);
      const away = sideOf(right);
      const matchLabel = matchName(fromEnd, matchNumber);
      fixtures.push(
        makeFixture({
          id,
          stage: "knockout",
          round,
          roundLabel,
          roundIndex: roundIndexOffset + round,
          matchNumber,
          matchLabel,
          home,
          away,
          schedule,
        })
      );
      next.push({ kind: "winner", fixtureId: id, matchLabel });
    }
    current = next;
  }
  return { fixtures, byes, rounds: totalRounds };
}

// ---------- the one function the UI calls ----------

// options: { teams, format, qualifiers, durationMinutes, breakMinutes }
// Throws FixtureGenerationError with a readable message when the input is not valid.
export function generateFixtures(options) {
  const {
    teams,
    format,
    qualifiers = null,
    durationMinutes = DEFAULT_SCHEDULE.durationMinutes,
    breakMinutes = DEFAULT_SCHEDULE.breakMinutes,
  } = options;

  if (!Object.values(FIXTURE_FORMATS).includes(format)) {
    throw new FixtureGenerationError("Choose a fixture format.");
  }
  const schedule = { durationMinutes, breakMinutes };
  const durationErrors = validateDurations(schedule);
  if (durationErrors.length) throw new FixtureGenerationError(durationErrors[0].message);

  const eligible = getEligibleTeams(teams);
  if (eligible.length < 2) {
    throw new FixtureGenerationError(`At least 2 approved teams are needed to generate fixtures (found ${eligible.length}).`);
  }

  const teamIds = eligible.map((t) => t.id); // registration order

  let result;
  if (format === FIXTURE_FORMATS.LEAGUE) {
    result = generateLeague(teamIds, { schedule });
  } else if (format === FIXTURE_FORMATS.KNOCKOUT) {
    result = generateKnockout(
      teamIds.map((teamId) => ({ teamId })),
      { schedule }
    );
  } else {
    if (teamIds.length < 3) {
      throw new FixtureGenerationError("League + Knockout needs at least 3 approved teams.");
    }
    const count = qualifiers ?? defaultQualifiers(teamIds.length);
    if (!Number.isInteger(count) || count < 2 || count > teamIds.length) {
      throw new FixtureGenerationError(`Qualifiers must be a whole number between 2 and ${teamIds.length}.`);
    }
    const league = generateLeague(teamIds, { schedule });
    const knockout = generateKnockout(
      Array.from({ length: count }, (_, i) => ({
        from: { type: "league_position", position: i + 1 },
        label: `${ordinal(i + 1)} in league`,
      })),
      { roundIndexOffset: league.rounds, schedule }
    );
    result = {
      fixtures: [...league.fixtures, ...knockout.fixtures],
      byes: [...league.byes, ...knockout.byes],
      rounds: league.rounds + knockout.rounds,
    };
  }

  return {
    fixtures: result.fixtures,
    byes: result.byes,
    summary: { teamCount: teamIds.length, rounds: result.rounds, fixtureCount: result.fixtures.length },
  };
}
