import { normalizeRules } from "../config/rules";

// Builds a team with `starters` players on the pitch and `bench` substitutes.
// Player ids are unique across both teams, so tests can use them freely.
export function makeTeam(side, { starters = 5, bench = 3 } = {}) {
  const base = side === "home" ? 100 : 200;
  const players = [];
  for (let i = 1; i <= starters + bench; i++) {
    players.push({
      id: base + i,
      name: `${side}-player-${i}`,
      jersey: i,
      bench: i > starters,
    });
  }
  return {
    id: base,
    name: side === "home" ? "Home FC" : "Away FC",
    logo: null,
    color: side === "home" ? "#0E7A4F" : "#1F5FBF",
    players,
  };
}

// A complete `match` object (what the API will return later).
export function makeMatch({ playersPerSide = 5, bench = 3, rules = {} } = {}) {
  return {
    id: 1,
    tournament: {
      id: 1,
      name: "Test Cup",
      sport: "football",
      rules: normalizeRules({ playersPerSide, ...rules }),
    },
    teams: {
      home: makeTeam("home", { starters: playersPerSide, bench }),
      away: makeTeam("away", { starters: playersPerSide, bench }),
    },
  };
}

let counter = 0;
// Builds an event the way MatchCentre does.
export function ev(type, side, playerId, extra = {}) {
  counter++;
  return {
    id: `e${counter}`,
    matchId: "m1",
    sequence: counter,
    type,
    side,
    playerId,
    playerInId: null,
    second: counter * 10,
    createdAt: "2026-11-18T10:00:00.000Z",
    voidedAt: null,
    ...extra,
  };
}

// Player ids in a generated team: home starters 101..N, away starters 201..N.
export const home = (n) => 100 + n;
export const away = (n) => 200 + n;
