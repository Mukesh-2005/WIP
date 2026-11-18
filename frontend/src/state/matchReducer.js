import { getSport, otherSide } from "../config/sports";

// ---------------------------------------------------------------------------
// Event shape (this is also what the backend will store):
//   {
//     id, sequence,                    // unique id, order in which it was recorded
//     type,                            // key of the sport's eventTypes
//     side: "home" | "away",           // which side the event belongs to
//     playerId, playerInId,            // players involved (playerInId only for subs)
//     second,                          // match clock when it happened
//     createdAt,                       // real-world time (ISO string)
//     voidedAt: null | ISO string      // set by "Undo"; the event is kept for history
//   }
// ---------------------------------------------------------------------------

export const initialState = { events: [] };

export function createState(record) {
  return { events: record?.events ?? [] };
}

export function matchReducer(state, action) {
  switch (action.type) {
    case "ADD_EVENT":
      return { ...state, events: [...state.events, action.event] };

    case "UNDO_LAST": {
      // Void the most recent event that is still active (never delete it).
      let target = -1;
      for (let i = state.events.length - 1; i >= 0; i--) {
        if (!state.events[i].voidedAt) {
          target = i;
          break;
        }
      }
      if (target === -1) return state;
      return {
        ...state,
        events: state.events.map((e, i) => (i === target ? { ...e, voidedAt: action.at } : e)),
      };
    }

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// Events that still count (not undone).
export const activeEvents = (events) => events.filter((e) => !e.voidedAt);

// The score is NOT stored. It is calculated from the active events.
export function calculateScore(events, sportId = "football") {
  const types = getSport(sportId).eventTypes;
  const score = { home: 0, away: 0 };
  for (const e of activeEvents(events)) {
    const scores = types[e.type]?.scores;
    if (scores === "self") score[e.side]++;
    if (scores === "opponent") score[otherSide(e.side)]++;
  }
  return score;
}

// Who is on the pitch? Also derived from events, never stored.
// Starters begin on the pitch. A substitution swaps a player. A red card removes
// a player for good. A replacement fills a slot left by a red card.
// A bench player can come on only once.
export function getSquad(teams, side, events, sportId = "football") {
  const types = getSport(sportId).eventTypes;
  const team = teams[side];
  const onPitch = new Set(team.players.filter((p) => !p.bench).map((p) => p.id));
  const cameOn = new Set();
  let sentOff = 0;
  let replacements = 0;

  for (const e of activeEvents(events)) {
    if (e.side !== side) continue;
    const kind = types[e.type]?.kind;
    if (kind === "substitution") {
      onPitch.delete(e.playerId);
      onPitch.add(e.playerInId);
      cameOn.add(e.playerInId);
    }
    if (kind === "replacement") {
      onPitch.add(e.playerInId);
      cameOn.add(e.playerInId);
      replacements++;
    }
    if (types[e.type]?.sendsOff) {
      onPitch.delete(e.playerId);
      sentOff++;
    }
  }

  return {
    onPitch: team.players.filter((p) => onPitch.has(p.id)),
    bench: team.players.filter((p) => p.bench && !cameOn.has(p.id)),
    pendingReplacements: sentOff - replacements,
  };
}

// Counts cards and player changes per side (for the full-time summary).
export function summarizeEvents(events, sportId = "football") {
  const types = getSport(sportId).eventTypes;
  const blank = () => ({ yellow: 0, red: 0, subs: 0 });
  const stats = { home: blank(), away: blank() };
  for (const e of activeEvents(events)) {
    if (e.type === "yellow_card") stats[e.side].yellow++;
    if (types[e.type]?.sendsOff) stats[e.side].red++;
    if (types[e.type]?.kind === "substitution" || types[e.type]?.kind === "replacement") {
      stats[e.side].subs++;
    }
  }
  return stats;
}
