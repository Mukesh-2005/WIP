import { describe, it, expect } from "vitest";
import {
  matchReducer,
  initialState,
  activeEvents,
  calculateScore,
  getSquad,
  summarizeEvents,
} from "../state/matchReducer";
import { makeMatch, ev, home, away } from "./helpers";

const { teams } = makeMatch();
const apply = (events) => events.reduce((s, e) => matchReducer(s, { type: "ADD_EVENT", event: e }), initialState);

describe("score (derived from events)", () => {
  it("starts 0 - 0", () => {
    expect(calculateScore([])).toEqual({ home: 0, away: 0 });
  });

  it("a goal counts for the scoring side", () => {
    const events = [ev("goal", "home", home(1)), ev("goal", "away", away(1)), ev("goal", "home", home(2))];
    expect(calculateScore(events)).toEqual({ home: 2, away: 1 });
  });

  it("an own goal counts for the OPPONENT", () => {
    expect(calculateScore([ev("own_goal", "home", home(1))])).toEqual({ home: 0, away: 1 });
    expect(calculateScore([ev("own_goal", "away", away(1))])).toEqual({ home: 1, away: 0 });
  });

  it("cards and substitutions never change the score", () => {
    const events = [
      ev("yellow_card", "home", home(1)),
      ev("red_card", "away", away(1)),
      ev("substitution", "home", home(2), { playerInId: home(6) }),
    ];
    expect(calculateScore(events)).toEqual({ home: 0, away: 0 });
  });

  it("ignores events that were undone (voided)", () => {
    const events = [ev("goal", "home", home(1), { voidedAt: "2026-11-18T10:05:00.000Z" })];
    expect(calculateScore(events)).toEqual({ home: 0, away: 0 });
  });
});

describe("undo", () => {
  it("voids the last active event but keeps it in history", () => {
    let state = apply([ev("goal", "home", home(1)), ev("goal", "away", away(1))]);
    state = matchReducer(state, { type: "UNDO_LAST", at: "T1" });

    expect(state.events).toHaveLength(2); // history is kept
    expect(state.events[1].voidedAt).toBe("T1");
    expect(activeEvents(state.events)).toHaveLength(1);
    expect(calculateScore(state.events)).toEqual({ home: 1, away: 0 });
  });

  it("repeated undo walks backwards through events", () => {
    let state = apply([ev("goal", "home", home(1)), ev("goal", "home", home(2)), ev("goal", "away", away(1))]);
    state = matchReducer(state, { type: "UNDO_LAST", at: "T1" });
    state = matchReducer(state, { type: "UNDO_LAST", at: "T2" });
    expect(activeEvents(state.events).map((e) => e.sequence)).toHaveLength(1);
    expect(calculateScore(state.events)).toEqual({ home: 1, away: 0 });
  });

  it("does nothing (no crash) when there is nothing left to undo", () => {
    let state = apply([ev("goal", "home", home(1))]);
    state = matchReducer(state, { type: "UNDO_LAST", at: "T1" });
    const again = matchReducer(state, { type: "UNDO_LAST", at: "T2" });
    expect(again).toBe(state);
    expect(matchReducer(initialState, { type: "UNDO_LAST", at: "T" })).toBe(initialState);
  });

  it("an undone own goal removes the point from the opponent", () => {
    let state = apply([ev("own_goal", "home", home(1))]);
    expect(calculateScore(state.events)).toEqual({ home: 0, away: 1 });
    state = matchReducer(state, { type: "UNDO_LAST", at: "T" });
    expect(calculateScore(state.events)).toEqual({ home: 0, away: 0 });
  });

  it("never mutates the previous state", () => {
    const before = apply([ev("goal", "home", home(1))]);
    const snapshot = JSON.stringify(before);
    matchReducer(before, { type: "UNDO_LAST", at: "T" });
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("RESET clears everything", () => {
    const state = apply([ev("goal", "home", home(1))]);
    expect(matchReducer(state, { type: "RESET" }).events).toEqual([]);
  });
});

describe("squad (who is on the pitch)", () => {
  it("starters are on the pitch, substitutes on the bench", () => {
    const squad = getSquad(teams, "home", []);
    expect(squad.onPitch).toHaveLength(5);
    expect(squad.bench).toHaveLength(3);
  });

  it("a substitution swaps the players", () => {
    const events = [ev("substitution", "home", home(1), { playerInId: home(6) })];
    const squad = getSquad(teams, "home", events);
    const ids = squad.onPitch.map((p) => p.id);
    expect(ids).not.toContain(home(1));
    expect(ids).toContain(home(6));
    expect(squad.bench.map((p) => p.id)).not.toContain(home(6));
  });

  it("a substituted-off player cannot come back", () => {
    const events = [ev("substitution", "home", home(1), { playerInId: home(6) })];
    const squad = getSquad(teams, "home", events);
    expect(squad.bench.map((p) => p.id)).not.toContain(home(1));
    expect(squad.onPitch.map((p) => p.id)).not.toContain(home(1));
  });

  it("a red card removes the player for good", () => {
    const squad = getSquad(teams, "away", [ev("red_card", "away", away(2))]);
    expect(squad.onPitch).toHaveLength(4);
    expect(squad.onPitch.map((p) => p.id)).not.toContain(away(2));
    expect(squad.pendingReplacements).toBe(1);
  });

  it("only affects the side the event belongs to", () => {
    const events = [ev("red_card", "away", away(1))];
    expect(getSquad(teams, "home", events).onPitch).toHaveLength(5);
  });

  it("undoing a substitution brings the original player back", () => {
    let state = apply([ev("substitution", "home", home(1), { playerInId: home(6) })]);
    state = matchReducer(state, { type: "UNDO_LAST", at: "T" });
    const squad = getSquad(teams, "home", state.events);
    expect(squad.onPitch.map((p) => p.id)).toContain(home(1));
    expect(squad.bench.map((p) => p.id)).toContain(home(6));
  });

  it("undoing a red card puts the player back on the pitch", () => {
    let state = apply([ev("red_card", "home", home(3))]);
    state = matchReducer(state, { type: "UNDO_LAST", at: "T" });
    expect(getSquad(teams, "home", state.events).onPitch).toHaveLength(5);
  });
});

describe("summary counts", () => {
  it("counts cards and substitutions per side (undone events excluded)", () => {
    const events = [
      ev("yellow_card", "home", home(1)),
      ev("yellow_card", "home", home(2)),
      ev("red_card", "away", away(1)),
      ev("substitution", "away", away(2), { playerInId: away(6) }),
      ev("yellow_card", "away", away(3), { voidedAt: "T" }),
    ];
    const stats = summarizeEvents(events);
    expect(stats.home).toEqual({ yellow: 2, red: 0, subs: 0 });
    expect(stats.away).toEqual({ yellow: 0, red: 1, subs: 1 });
  });
});
