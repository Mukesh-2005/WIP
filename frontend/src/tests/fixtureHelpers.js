import { TEAM_APPROVAL, DEFAULT_SCHEDULE } from "../config/fixtures";

// n approved teams with ids 1..n, plus optional extra teams in other states.
export function makeTeams(n, { pending = 0, rejected = 0 } = {}) {
  const teams = [];
  let id = 1;
  const add = (approvalStatus) => {
    teams.push({ id, name: `Team ${id}`, approvalStatus, logo: null, color: "#000", players: [] });
    id += 1;
  };
  for (let i = 0; i < n; i++) add(TEAM_APPROVAL.APPROVED);
  for (let i = 0; i < pending; i++) add(TEAM_APPROVAL.PENDING);
  for (let i = 0; i < rejected; i++) add(TEAM_APPROVAL.REJECTED);
  return teams;
}

export const pitches = [
  { id: "pitch-a", name: "Pitch A" },
  { id: "pitch-b", name: "Pitch B" },
];

export const tournament = { id: 1, startDate: "2026-11-20", endDate: "2026-12-20" };

export const makeCtx = (teams) => ({ teams, pitches, tournament });

// A hand-made fixture for validation tests.
export function fx(id, home, away, extra = {}) {
  return {
    id,
    stage: "league",
    round: 1,
    roundKey: "league-1",
    roundLabel: "League · Round 1",
    roundIndex: 1,
    matchNumber: 1,
    matchLabel: id,
    homeTeamId: home,
    awayTeamId: away,
    homeLabel: null,
    awayLabel: null,
    startsAt: null,
    pitchId: null,
    status: "pending",
    result: null,
    ...DEFAULT_SCHEDULE,
    ...extra,
  };
}

// A fixture that already has a date, time and pitch.
export const scheduled = (id, home, away, startsAt, pitchId = "pitch-a", extra = {}) =>
  fx(id, home, away, { startsAt, pitchId, status: "scheduled", ...extra });

export const pairKey = (f) => [f.homeTeamId, f.awayTeamId].sort((a, b) => a - b).join("-");
