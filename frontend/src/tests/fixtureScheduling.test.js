import { describe, it, expect } from "vitest";
import { validateFixtureSchedule, validateAllFixtures, ERROR } from "../fixtures/validation";
import {
  updateFixture,
  cancelFixture,
  completeFixture,
  fixtureStats,
  filterFixtures,
  autoSchedule,
  deriveStatus,
} from "../fixtures/scheduling";
import { generateFixtures } from "../fixtures/generator";
import { toMinutes, fromMinutes, addDays } from "../fixtures/time";
import { makeTeams, makeCtx, fx, scheduled } from "./fixtureHelpers";

const teams = makeTeams(6, { pending: 1, rejected: 1 }); // ids 1-6 approved, 7 pending, 8 rejected
const ctx = makeCtx(teams);
const codes = (errors) => errors.map((e) => e.code);

// 40 min match + 10 min break = a fixture blocks 50 minutes from its start.
const A = scheduled("A", 1, 2, "2026-11-20T10:00", "pitch-a");

describe("time helpers", () => {
  it("converts to minutes and back, and rejects impossible dates", () => {
    expect(fromMinutes(toMinutes("2026-11-20T10:00"))).toBe("2026-11-20T10:00");
    expect(toMinutes("2026-02-31T10:00")).toBeNull();
    expect(toMinutes("2026-11-20T25:00")).toBeNull();
    expect(toMinutes("tomorrow")).toBeNull();
    expect(toMinutes(null)).toBeNull();
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
});

describe("pitch conflicts", () => {
  it("rejects two matches on the same pitch at overlapping times", () => {
    const candidate = scheduled("B", 3, 4, "2026-11-20T10:30", "pitch-a");
    const errors = validateFixtureSchedule(candidate, [A], ctx);
    expect(codes(errors)).toEqual([ERROR.PITCH_CONFLICT]);
    expect(errors[0].message).toMatch(/Pitch A is already booked for Team 1 vs Team 2/);
    expect(errors[0].message).toMatch(/10:00–10:40/);
  });

  it("allows the same time on a different pitch", () => {
    const candidate = scheduled("B", 3, 4, "2026-11-20T10:00", "pitch-b");
    expect(validateFixtureSchedule(candidate, [A], ctx)).toEqual([]);
  });

  it("includes the break: 10:40 is still blocked, 10:50 is free", () => {
    const tooSoon = scheduled("B", 3, 4, "2026-11-20T10:40", "pitch-a");
    const ok = scheduled("C", 3, 4, "2026-11-20T10:50", "pitch-a");
    expect(codes(validateFixtureSchedule(tooSoon, [A], ctx))).toContain(ERROR.PITCH_CONFLICT);
    expect(validateFixtureSchedule(ok, [A], ctx)).toEqual([]);
  });

  it("catches a new match that starts before an existing one but runs into it", () => {
    const candidate = scheduled("B", 3, 4, "2026-11-20T09:30", "pitch-a");
    expect(codes(validateFixtureSchedule(candidate, [A], ctx))).toContain(ERROR.PITCH_CONFLICT);
  });

  it("different days never clash", () => {
    const candidate = scheduled("B", 3, 4, "2026-11-21T10:00", "pitch-a");
    expect(validateFixtureSchedule(candidate, [A], ctx)).toEqual([]);
  });

  it("a cancelled fixture no longer blocks the pitch", () => {
    const cancelled = { ...A, status: "cancelled" };
    const candidate = scheduled("B", 3, 4, "2026-11-20T10:00", "pitch-a");
    expect(validateFixtureSchedule(candidate, [cancelled], ctx)).toEqual([]);
  });

  it("a fixture does not clash with itself when it is edited", () => {
    expect(validateFixtureSchedule(A, [A], ctx)).toEqual([]);
  });

  it("uses each fixture's own duration and break", () => {
    const long = scheduled("L", 1, 2, "2026-11-20T10:00", "pitch-a", { durationMinutes: 90, breakMinutes: 0 });
    const at1120 = scheduled("B", 3, 4, "2026-11-20T11:20", "pitch-a");
    const at1130 = scheduled("C", 3, 4, "2026-11-20T11:30", "pitch-a");
    expect(codes(validateFixtureSchedule(at1120, [long], ctx))).toContain(ERROR.PITCH_CONFLICT);
    expect(validateFixtureSchedule(at1130, [long], ctx)).toEqual([]);
  });
});

describe("team conflicts", () => {
  it("rejects a team in two matches at the same time, even on different pitches", () => {
    const candidate = scheduled("B", 1, 5, "2026-11-20T10:20", "pitch-b");
    const errors = validateFixtureSchedule(candidate, [A], ctx);
    expect(codes(errors)).toEqual([ERROR.TEAM_CONFLICT]);
    expect(errors[0].message).toMatch(/Team 1 is already playing in Team 1 vs Team 2/);
  });

  it("works for the away team too, and reports both teams when both clash", () => {
    expect(codes(validateFixtureSchedule(scheduled("B", 5, 2, "2026-11-20T10:00", "pitch-b"), [A], ctx))).toEqual([ERROR.TEAM_CONFLICT]);
    expect(codes(validateFixtureSchedule(scheduled("B", 2, 1, "2026-11-20T10:00", "pitch-b"), [A], ctx))).toEqual([
      ERROR.DUPLICATE_FIXTURE,
      ERROR.TEAM_CONFLICT,
      ERROR.TEAM_CONFLICT,
    ]);
  });

  it("allows a team to play later the same day", () => {
    const candidate = scheduled("B", 1, 5, "2026-11-20T11:00", "pitch-b");
    expect(validateFixtureSchedule(candidate, [A], ctx)).toEqual([]);
  });

  it("a team conflict is found even without a pitch", () => {
    const candidate = fx("B", 1, 5, { startsAt: "2026-11-20T10:10" });
    expect(codes(validateFixtureSchedule(candidate, [A], ctx))).toEqual([ERROR.TEAM_CONFLICT]);
  });
});

describe("invalid scheduling", () => {
  it("rejects a team playing itself", () => {
    expect(codes(validateFixtureSchedule(fx("B", 3, 3), [], ctx))).toContain(ERROR.SAME_TEAM);
  });

  it("rejects unapproved, rejected and unknown teams", () => {
    expect(codes(validateFixtureSchedule(fx("B", 7, 1), [], ctx))).toEqual([ERROR.TEAM_NOT_APPROVED]);
    expect(codes(validateFixtureSchedule(fx("B", 1, 8), [], ctx))).toEqual([ERROR.TEAM_NOT_APPROVED]);
    expect(validateFixtureSchedule(fx("B", 1, 99), [], ctx)[0].message).toMatch(/Team 99 is not an approved team/);
  });

  it("rejects a duplicate pairing in the same stage (either way round)", () => {
    const existing = fx("A", 1, 2, { stage: "league" });
    expect(codes(validateFixtureSchedule(fx("B", 2, 1), [existing], ctx))).toEqual([ERROR.DUPLICATE_FIXTURE]);
    expect(codes(validateFixtureSchedule(fx("B", 1, 2), [existing], ctx))).toEqual([ERROR.DUPLICATE_FIXTURE]);
  });

  it("allows the same pairing again in the knockout stage", () => {
    const existing = fx("A", 1, 2, { stage: "league" });
    expect(validateFixtureSchedule(fx("C", 1, 2, { stage: "knockout" }), [existing], ctx)).toEqual([]);
  });

  it("rejects impossible dates, bad durations and unknown pitches", () => {
    expect(codes(validateFixtureSchedule(fx("B", 1, 2, { startsAt: "2026-02-31T10:00", pitchId: "pitch-a" }), [], ctx))).toContain(ERROR.INVALID_DATE);
    expect(codes(validateFixtureSchedule(fx("B", 1, 2, { durationMinutes: 0 }), [], ctx))).toContain(ERROR.INVALID_DURATION);
    expect(codes(validateFixtureSchedule(fx("B", 1, 2, { breakMinutes: -1 }), [], ctx))).toContain(ERROR.INVALID_DURATION);
    expect(codes(validateFixtureSchedule(fx("B", 1, 2, { durationMinutes: NaN }), [], ctx))).toContain(ERROR.INVALID_DURATION);
    expect(codes(validateFixtureSchedule(fx("B", 1, 2, { pitchId: "pitch-z" }), [], ctx))).toContain(ERROR.UNKNOWN_PITCH);
  });

  it("allows TBD teams (knockout placeholders) but still checks the pitch", () => {
    const tbd = fx("K", null, null, { stage: "knockout", startsAt: "2026-11-20T10:20", pitchId: "pitch-a" });
    expect(codes(validateFixtureSchedule(tbd, [A], ctx))).toEqual([ERROR.PITCH_CONFLICT]);
    expect(validateFixtureSchedule({ ...tbd, pitchId: "pitch-b" }, [A], ctx)).toEqual([]);
  });

});

describe("editing, rescheduling, cancelling", () => {
  const list = [fx("A", 1, 2), fx("B", 3, 4)];

  it("scheduling sets the status to scheduled; clearing the pitch makes it pending again", () => {
    const set = updateFixture(list, "A", { startsAt: "2026-11-20T10:00", pitchId: "pitch-a" }, ctx);
    expect(set.ok).toBe(true);
    expect(set.fixtures[0].status).toBe("scheduled");
    const cleared = updateFixture(set.fixtures, "A", { pitchId: "" }, ctx);
    expect(cleared.fixtures[0]).toMatchObject({ status: "pending", pitchId: null });
  });

  it("a rejected change leaves the list untouched and explains why", () => {
    const base = updateFixture(list, "A", { startsAt: "2026-11-20T10:00", pitchId: "pitch-a" }, ctx).fixtures;
    const clash = updateFixture(base, "B", { startsAt: "2026-11-20T10:10", pitchId: "pitch-a" }, ctx);
    expect(clash.ok).toBe(false);
    expect(clash.fixtures).toBe(base);
    expect(clash.errors[0].message).toMatch(/Pitch A is already booked/);
  });

  it("reschedules to a free slot, and never edits the old list in place", () => {
    const base = updateFixture(list, "A", { startsAt: "2026-11-20T10:00", pitchId: "pitch-a" }, ctx).fixtures;
    const moved = updateFixture(base, "A", { startsAt: "2026-11-21T15:00" }, ctx);
    expect(moved.ok).toBe(true);
    expect(moved.fixtures[0].startsAt).toBe("2026-11-21T15:00");
    expect(base[0].startsAt).toBe("2026-11-20T10:00");
  });

  it("assigns teams to a placeholder fixture, but only approved ones", () => {
    const ko = [fx("K", null, null, { stage: "knockout", homeLabel: "Winner of SF1" })];
    expect(updateFixture(ko, "K", { homeTeamId: "7" }, ctx).ok).toBe(false); // pending team
    const ok = updateFixture(ko, "K", { homeTeamId: "1", awayTeamId: "2" }, ctx);
    expect(ok.fixtures[0]).toMatchObject({ homeTeamId: 1, awayTeamId: 2 });
  });

  it("cancelling a fixture frees its pitch and teams for other matches", () => {
    const base = [scheduled("A", 1, 2, "2026-11-20T10:00", "pitch-a"), fx("B", 3, 4)];
    const cancelled = cancelFixture(base, "A");
    expect(cancelled.ok).toBe(true);
    expect(cancelled.fixtures[0].status).toBe("cancelled");
    expect(cancelled.fixtures[1]).toBe(base[1]); // other fixtures untouched

    // before cancelling, the slot was taken; after cancelling it is free
    expect(updateFixture(base, "B", { startsAt: "2026-11-20T10:00", pitchId: "pitch-a" }, ctx).ok).toBe(false);
    expect(updateFixture(cancelled.fixtures, "B", { startsAt: "2026-11-20T10:00", pitchId: "pitch-a" }, ctx).ok).toBe(true);
  });

  it("cancelled and completed fixtures cannot be edited, and completed ones cannot be cancelled", () => {
    const base = [fx("A", 1, 2)];
    const cancelled = cancelFixture(base, "A").fixtures;
    expect(updateFixture(cancelled, "A", { pitchId: "pitch-a" }, ctx).ok).toBe(false);
    const done = completeFixture(base, "A", { home: 2, away: 1 });
    expect(done[0]).toMatchObject({ status: "completed", result: { home: 2, away: 1 } });
    expect(updateFixture(done, "A", { pitchId: "pitch-a" }, ctx).errors[0].message).toMatch(/completed/);
    expect(cancelFixture(done, "A").ok).toBe(false);
    expect(completeFixture(cancelled, "A", { home: 1, away: 0 })[0].status).toBe("cancelled");
  });

  it("deriveStatus", () => {
    expect(deriveStatus(fx("A", 1, 2))).toBe("pending");
    expect(deriveStatus(fx("A", 1, 2, { startsAt: "2026-11-20T10:00" }))).toBe("pending");
    expect(deriveStatus(fx("A", 1, 2, { startsAt: "2026-11-20T10:00", pitchId: "pitch-a" }))).toBe("scheduled");
  });
});

describe("dashboard numbers and filters", () => {
  const list = [
    scheduled("A", 1, 2, "2026-11-20T10:00", "pitch-a", { roundKey: "league-1" }),
    scheduled("B", 3, 4, "2026-11-21T10:00", "pitch-b", { roundKey: "league-2" }),
    fx("C", 5, 6, { status: "completed", roundKey: "league-1", startsAt: "2026-11-20T12:00", pitchId: "pitch-b" }),
    fx("D", 1, 3, { status: "cancelled", roundKey: "league-2" }),
    fx("E", 2, 4, { roundKey: "league-3" }),
  ];

  it("counts fixtures by status", () => {
    expect(fixtureStats(list)).toEqual({ total: 5, scheduled: 2, completed: 1, pending: 1, cancelled: 1 });
    expect(fixtureStats([])).toEqual({ total: 0, scheduled: 0, completed: 0, pending: 0, cancelled: 0 });
  });

  it("filters by round, date, pitch and status, alone or together", () => {
    const ids = (f) => filterFixtures(list, f).map((x) => x.id);
    expect(ids({ roundKey: "league-1" })).toEqual(["A", "C"]);
    expect(ids({ date: "2026-11-20" })).toEqual(["A", "C"]);
    expect(ids({ pitchId: "pitch-b" })).toEqual(["B", "C"]);
    expect(ids({ status: "cancelled" })).toEqual(["D"]);
    expect(ids({ roundKey: "league-1", pitchId: "pitch-b" })).toEqual(["C"]);
    expect(ids({})).toHaveLength(5);
    expect(ids({ date: "2030-01-01" })).toEqual([]);
  });
});

describe("auto-schedule", () => {
  const options = { startDate: "2026-11-20", dayStart: "09:00", dayEnd: "12:00" };

  for (const [count, format] of [
    [5, "league"],
    [8, "league"],
    [7, "knockout"],
    [6, "league_knockout"],
  ]) {
    it(`schedules ${count} teams (${format}) with no clashes at all`, () => {
      const teamList = makeTeams(count);
      const c = makeCtx(teamList);
      const { fixtures } = generateFixtures({ teams: teamList, format, qualifiers: format === "league_knockout" ? 4 : null });
      const result = autoSchedule(fixtures, options, c);
      expect(result.unplaced).toEqual([]);
      expect(result.placed).toBe(fixtures.length);
      expect(result.fixtures.every((f) => f.status === "scheduled")).toBe(true);
      expect(validateAllFixtures(result.fixtures, c)).toEqual([]);
      // every match ends inside the day window
      for (const f of result.fixtures) {
        const start = toMinutes(f.startsAt) - toMinutes(`${f.startsAt.slice(0, 10)}T00:00`);
        expect(start).toBeGreaterThanOrEqual(9 * 60);
        expect(start + f.durationMinutes).toBeLessThanOrEqual(12 * 60);
      }
    });
  }

  it("puts knockout matches after the league and the final last", () => {
    const teamList = makeTeams(5);
    const c = makeCtx(teamList);
    const { fixtures } = generateFixtures({ teams: teamList, format: "league_knockout", qualifiers: 4 });
    const { fixtures: out } = autoSchedule(fixtures, options, c);
    const lastLeague = Math.max(...out.filter((f) => f.stage === "league").map((f) => toMinutes(f.startsAt)));
    const firstKnockout = Math.min(...out.filter((f) => f.stage === "knockout").map((f) => toMinutes(f.startsAt)));
    expect(firstKnockout).toBeGreaterThan(lastLeague);
    const final = out.find((f) => f.matchLabel === "Final");
    expect(toMinutes(final.startsAt)).toBe(Math.max(...out.map((f) => toMinutes(f.startsAt))));
  });

  it("leaves fixtures that are already scheduled alone and works around them", () => {
    const teamList = makeTeams(4);
    const c = makeCtx(teamList);
    const { fixtures } = generateFixtures({ teams: teamList, format: "league" });
    const fixed = updateFixture(fixtures, fixtures[0].id, { startsAt: "2026-11-20T09:00", pitchId: "pitch-a" }, c).fixtures;
    const result = autoSchedule(fixed, options, c);
    expect(result.fixtures[0].startsAt).toBe("2026-11-20T09:00");
    expect(result.placed).toBe(fixtures.length - 1);
    expect(validateAllFixtures(result.fixtures, c)).toEqual([]);
  });

  it("reports fixtures that cannot be placed, and keeps the rest valid", () => {
    const teamList = makeTeams(6);
    const c = { ...makeCtx(teamList), tournament: { startDate: "2026-11-20", endDate: "2026-11-20" } };
    const { fixtures } = generateFixtures({ teams: teamList, format: "league" });
    const result = autoSchedule(fixtures, { startDate: "2026-11-20", dayStart: "09:00", dayEnd: "10:30" }, c);
    expect(result.unplaced.length).toBeGreaterThan(0);
    expect(result.placed + result.unplaced.length).toBe(fixtures.length);
    expect(validateAllFixtures(result.fixtures, c)).toEqual([]);
  });
});

describe("validateAllFixtures", () => {
  it("reports a clash once, not twice", () => {
    const list = [scheduled("A", 1, 2, "2026-11-20T10:00", "pitch-a"), scheduled("B", 3, 4, "2026-11-20T10:10", "pitch-a")];
    const problems = validateAllFixtures(list, ctx);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe(ERROR.PITCH_CONFLICT);
  });

  it("flags a team that was un-approved after the fixture was created", () => {
    const list = [fx("A", 1, 7)];
    expect(codes(validateAllFixtures(list, ctx))).toEqual([ERROR.TEAM_NOT_APPROVED]);
  });

  it("ignores cancelled fixtures", () => {
    const list = [{ ...fx("A", 1, 7), status: "cancelled" }];
    expect(validateAllFixtures(list, ctx)).toEqual([]);
  });
});
