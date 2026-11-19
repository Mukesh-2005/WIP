import { describe, it, expect } from "vitest";
import {
  generateFixtures,
  getEligibleTeams,
  roundRobinRounds,
  seedOrder,
  defaultQualifiers,
  FixtureGenerationError,
} from "../fixtures/generator";
import { FIXTURE_FORMATS } from "../config/fixtures";
import { makeTeams, pairKey } from "./fixtureHelpers";

const ids = (n) => Array.from({ length: n }, (_, i) => i + 1);
const generate = (n, format, extra = {}, teamExtra = {}) =>
  generateFixtures({ teams: makeTeams(n, teamExtra), format, ...extra });

describe("eligible teams", () => {
  it("keeps only approved teams and ignores duplicates", () => {
    const teams = [...makeTeams(4, { pending: 2, rejected: 1 }), { id: 1, name: "Dup", approvalStatus: "approved" }];
    expect(getEligibleTeams(teams).map((t) => t.id)).toEqual([1, 2, 3, 4]);
  });

  it("never puts unapproved teams into fixtures", () => {
    const { fixtures } = generate(6, FIXTURE_FORMATS.LEAGUE, {}, { pending: 3, rejected: 2 });
    const used = new Set(fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId]));
    expect([...used].every((id) => id <= 6)).toBe(true);
  });
});

describe("league / round robin", () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16]) {
    describe(`${n} teams`, () => {
      const { fixtures, byes } = generate(n, FIXTURE_FORMATS.LEAGUE);
      const odd = n % 2 === 1;

      it("plays every pair exactly once (no duplicates)", () => {
        expect(fixtures).toHaveLength((n * (n - 1)) / 2);
        const keys = fixtures.map(pairKey);
        expect(new Set(keys).size).toBe(keys.length);
      });

      it("never makes a team play itself", () => {
        expect(fixtures.every((f) => f.homeTeamId !== f.awayTeamId)).toBe(true);
      });

      it("every team plays n-1 matches", () => {
        for (const id of ids(n)) {
          const played = fixtures.filter((f) => f.homeTeamId === id || f.awayTeamId === id).length;
          expect(played).toBe(n - 1);
        }
      });

      it("a team plays at most once per round", () => {
        const rounds = new Set(fixtures.map((f) => f.round));
        for (const round of rounds) {
          const teams = fixtures.filter((f) => f.round === round).flatMap((f) => [f.homeTeamId, f.awayTeamId]);
          expect(new Set(teams).size).toBe(teams.length);
        }
      });

      it(odd ? "uses byes: one team rests each round, each team once" : "has no byes", () => {
        if (!odd) {
          expect(byes).toHaveLength(0);
          expect(new Set(fixtures.map((f) => f.round)).size).toBe(n - 1);
          return;
        }
        expect(new Set(fixtures.map((f) => f.round)).size).toBe(n);
        expect(byes).toHaveLength(n);
        expect(new Set(byes.map((b) => b.teamId)).size).toBe(n);
        expect(new Set(byes.map((b) => b.roundKey)).size).toBe(n);
      });
    });
  }

  it("circle method on 4 teams gives 3 rounds of 2 matches", () => {
    const rounds = roundRobinRounds([1, 2, 3, 4]);
    expect(rounds).toHaveLength(3);
    expect(rounds.every((r) => r.matches.length === 2 && r.byes.length === 0)).toBe(true);
  });
});

describe("knockout", () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 12, 15, 16, 17]) {
    describe(`${n} teams`, () => {
      const { fixtures, byes } = generate(n, FIXTURE_FORMATS.KNOCKOUT);
      const size = 2 ** Math.ceil(Math.log2(n));

      it("has exactly n-1 matches, ending in a single final", () => {
        expect(fixtures).toHaveLength(n - 1);
        const last = Math.max(...fixtures.map((f) => f.round));
        expect(fixtures.filter((f) => f.round === last)).toHaveLength(1);
        expect(fixtures.find((f) => f.round === last).matchLabel).toBe("Final");
      });

      it("every team enters the bracket exactly once", () => {
        const entered = fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId]).filter((id) => id !== null);
        expect(new Set(entered).size).toBe(entered.length);
        expect(entered.sort((a, b) => a - b)).toEqual(ids(n));
      });

      it("never matches a team against itself or repeats a pairing", () => {
        const known = fixtures.filter((f) => f.homeTeamId && f.awayTeamId);
        expect(known.every((f) => f.homeTeamId !== f.awayTeamId)).toBe(true);
        const keys = known.map(pairKey);
        expect(new Set(keys).size).toBe(keys.length);
      });

      it("gives byes to the extra slots in a non power-of-two bracket", () => {
        expect(byes).toHaveLength(size - n);
        expect(byes.every((b) => b.roundKey === "knockout-1")).toBe(true);
      });

      it("later rounds are linked to the matches that feed them", () => {
        const byId = new Map(fixtures.map((f) => [f.id, f]));
        for (const f of fixtures.filter((x) => x.round > 1)) {
          for (const from of [f.homeFrom, f.awayFrom]) {
            if (from?.type === "winner") expect(byId.get(from.fixtureId).round).toBe(f.round - 1);
          }
        }
      });
    });
  }

  it("keeps the top seeds apart: seed order for 8", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(2)).toEqual([1, 2]);
  });

  it("5 teams: seeds 1-3 skip round 1", () => {
    const { fixtures, byes } = generate(5, FIXTURE_FORMATS.KNOCKOUT);
    expect(fixtures.filter((f) => f.round === 1)).toHaveLength(1);
    expect(byes.map((b) => b.teamId).sort()).toEqual([1, 2, 3]);
    expect(fixtures.find((f) => f.round === 1)).toMatchObject({ homeTeamId: 4, awayTeamId: 5 });
  });

  it("names the rounds", () => {
    const { fixtures } = generate(8, FIXTURE_FORMATS.KNOCKOUT);
    const labels = [...new Set(fixtures.map((f) => f.roundLabel))];
    expect(labels).toEqual(["Knockout · Quarter-finals", "Knockout · Semi-finals", "Knockout · Final"]);
  });
});

describe("league + knockout", () => {
  it("builds the league first, then a knockout of the qualifiers", () => {
    const { fixtures } = generate(8, FIXTURE_FORMATS.LEAGUE_KNOCKOUT);
    const league = fixtures.filter((f) => f.stage === "league");
    const knockout = fixtures.filter((f) => f.stage === "knockout");
    expect(league).toHaveLength(28);
    expect(knockout).toHaveLength(7); // 8 qualifiers -> 4 + 2 + 1
    expect(Math.min(...knockout.map((f) => f.roundIndex))).toBeGreaterThan(Math.max(...league.map((f) => f.roundIndex)));
  });

  it("knockout slots are placeholders until the league is finished", () => {
    const { fixtures } = generate(6, FIXTURE_FORMATS.LEAGUE_KNOCKOUT, { qualifiers: 4 });
    const first = fixtures.filter((f) => f.stage === "knockout" && f.round === 1);
    expect(first).toHaveLength(2);
    expect(first.every((f) => f.homeTeamId === null && f.awayTeamId === null)).toBe(true);
    expect(first[0]).toMatchObject({ homeLabel: "1st in league", awayLabel: "4th in league" });
  });

  it("handles an odd number of teams and a non power-of-two qualifier count", () => {
    const { fixtures, byes } = generate(7, FIXTURE_FORMATS.LEAGUE_KNOCKOUT, { qualifiers: 3 });
    expect(fixtures.filter((f) => f.stage === "league")).toHaveLength(21);
    expect(fixtures.filter((f) => f.stage === "knockout")).toHaveLength(2); // 3 qualifiers -> 2 matches
    expect(byes.filter((b) => b.roundKey.startsWith("league"))).toHaveLength(7);
    expect(byes.filter((b) => b.roundKey === "knockout-1")).toHaveLength(1);
  });

  it("the same pairing may meet again in the knockout (different stage)", () => {
    const { fixtures } = generate(4, FIXTURE_FORMATS.LEAGUE_KNOCKOUT, { qualifiers: 4 });
    expect(fixtures.filter((f) => f.stage === "knockout")).toHaveLength(3);
  });

  it("default qualifiers: largest power of two not above the team count", () => {
    expect([3, 4, 5, 8, 9, 16].map(defaultQualifiers)).toEqual([2, 4, 4, 8, 8, 16]);
  });
});

describe("generation rules", () => {
  it("every fixture starts as pending, unscheduled, with the chosen duration and break", () => {
    const { fixtures } = generate(4, FIXTURE_FORMATS.LEAGUE, { durationMinutes: 30, breakMinutes: 5 });
    expect(
      fixtures.every(
        (f) => f.status === "pending" && f.startsAt === null && f.pitchId === null && f.durationMinutes === 30 && f.breakMinutes === 5
      )
    ).toBe(true);
  });

  it("fixture ids are unique", () => {
    for (const format of Object.values(FIXTURE_FORMATS)) {
      const { fixtures } = generate(9, format);
      expect(new Set(fixtures.map((f) => f.id)).size).toBe(fixtures.length);
    }
  });

  it("refuses to generate with fewer than 2 approved teams, with a clear message", () => {
    expect(() => generate(1, FIXTURE_FORMATS.LEAGUE, {}, { pending: 5 })).toThrow(FixtureGenerationError);
    expect(() => generate(1, FIXTURE_FORMATS.LEAGUE, {}, { pending: 5 })).toThrow(/At least 2 approved teams/);
    expect(() => generate(0, FIXTURE_FORMATS.KNOCKOUT)).toThrow(/found 0/);
  });

  it("rejects bad options", () => {
    expect(() => generate(4, "swiss")).toThrow(/format/);
    expect(() => generate(4, FIXTURE_FORMATS.LEAGUE, { durationMinutes: 0 })).toThrow(/duration/i);
    expect(() => generate(4, FIXTURE_FORMATS.LEAGUE, { breakMinutes: -5 })).toThrow(/break/i);
    expect(() => generate(2, FIXTURE_FORMATS.LEAGUE_KNOCKOUT)).toThrow(/at least 3/);
    expect(() => generate(6, FIXTURE_FORMATS.LEAGUE_KNOCKOUT, { qualifiers: 7 })).toThrow(/Qualifiers/);
    expect(() => generate(6, FIXTURE_FORMATS.LEAGUE_KNOCKOUT, { qualifiers: 1 })).toThrow(/Qualifiers/);
  });

  it("gives the same fixtures every time for the same teams (registration order)", () => {
    const a = generate(8, FIXTURE_FORMATS.KNOCKOUT);
    const b = generate(8, FIXTURE_FORMATS.KNOCKOUT);
    expect(a.fixtures).toEqual(b.fixtures);
  });
});
