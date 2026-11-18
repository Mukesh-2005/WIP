import { describe, it, expect, beforeEach } from "vitest";
import { matchRepository } from "../services/matchRepository";
import { buildMatchRecord, restoreStatus } from "../state/matchRecord";
import { makeMatch, ev, home } from "./helpers";

// A tiny in-memory stand-in for the browser's localStorage.
function installFakeStorage() {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
  return data;
}

const match = makeMatch();
const record = (id, extra = {}) =>
  buildMatchRecord({
    matchId: id,
    match,
    status: "ended",
    clockSeconds: 600,
    startedAt: "2026-11-18T10:00:00.000Z",
    endedAt: "2026-11-18T10:10:00.000Z",
    events: [ev("goal", "home", home(1))],
    ...extra,
  });

describe("match record (what the backend will receive)", () => {
  it("contains everything needed to rebuild the match later", () => {
    const r = record("m1");
    expect(r).toMatchObject({
      id: "m1",
      tournamentId: 1,
      sport: "football",
      status: "ended",
      clockSeconds: 600,
      homeTeam: { id: 100, name: "Home FC" },
      awayTeam: { id: 200, name: "Away FC" },
      score: { home: 1, away: 0 },
    });
    expect(r.rules.playersPerSide).toBe(5);
    expect(r.events[0]).toHaveProperty("voidedAt");
    expect(r.events[0]).toHaveProperty("createdAt");
    expect(r.events[0]).toHaveProperty("sequence");
  });

  it("survives JSON (the format sent over HTTP)", () => {
    const r = record("m1");
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });

  it("keeps undone events in the saved history", () => {
    const r = record("m1", { events: [ev("goal", "home", home(1), { voidedAt: "T" })] });
    expect(r.events).toHaveLength(1);
    expect(r.score).toEqual({ home: 0, away: 0 });
  });

  it("a match saved as running is restored as paused", () => {
    expect(restoreStatus("running")).toBe("paused");
    expect(restoreStatus("paused")).toBe("paused");
    expect(restoreStatus("ended")).toBe("ended");
    expect(restoreStatus("idle")).toBe("idle");
  });
});

describe("match repository", () => {
  beforeEach(() => {
    installFakeStorage();
  });

  it("returns null when nothing is saved", async () => {
    expect(await matchRepository.loadCurrent()).toBeNull();
  });

  it("saves and loads the current match", async () => {
    await matchRepository.saveCurrent(record("m1", { status: "paused" }));
    expect((await matchRepository.loadCurrent()).id).toBe("m1");
  });

  it("clears the current match", async () => {
    await matchRepository.saveCurrent(record("m1"));
    await matchRepository.clearCurrent();
    expect(await matchRepository.loadCurrent()).toBeNull();
  });

  it("archives finished matches, newest first", async () => {
    await matchRepository.archiveMatch(record("m1"));
    await matchRepository.archiveMatch(record("m2"));
    const list = await matchRepository.listHistory();
    expect(list.map((m) => m.id)).toEqual(["m2", "m1"]);
  });

  it("archiving the same match twice does not duplicate it", async () => {
    await matchRepository.archiveMatch(record("m1"));
    await matchRepository.archiveMatch(record("m1"));
    expect(await matchRepository.listHistory()).toHaveLength(1);
  });

  it("history is retrievable with the full event list", async () => {
    await matchRepository.archiveMatch(record("m1"));
    const [saved] = await matchRepository.listHistory();
    expect(saved.events).toHaveLength(1);
    expect(saved.score).toEqual({ home: 1, away: 0 });
  });

  it("corrupted storage does not crash; it behaves as empty", async () => {
    globalThis.localStorage.setItem("turf.match.current", "{not json");
    globalThis.localStorage.setItem("turf.match.history", "also broken");
    expect(await matchRepository.loadCurrent()).toBeNull();
    expect(await matchRepository.listHistory()).toEqual([]);
  });

  it("blocked storage does not crash the app", async () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    await expect(matchRepository.saveCurrent(record("m1"))).resolves.toBeUndefined();
    expect(await matchRepository.loadCurrent()).toBeNull();
    await expect(matchRepository.clearCurrent()).resolves.toBeUndefined();
  });
});
