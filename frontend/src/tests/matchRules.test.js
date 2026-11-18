import { describe, it, expect } from "vitest";
import { getMatchIssues, canReplaceNow } from "../state/matchRules";
import { getSquad } from "../state/matchReducer";
import { validateRules, normalizeRules, describeRules, SUPPORTED_FORMATS } from "../config/rules";
import { makeMatch, ev, home, away } from "./helpers";

const reds = (side, n, idFor) => Array.from({ length: n }, (_, i) => ev("red_card", side, idFor(i + 1)));

describe("supported formats (not hardcoded to one size)", () => {
  it.each(SUPPORTED_FORMATS)("%i-a-side: a full lineup has no issues", (n) => {
    const { teams, tournament } = makeMatch({ playersPerSide: n, rules: { minPlayersToContinue: 3 } });
    expect(getMatchIssues(teams, [], tournament.rules)).toEqual([]);
    expect(getSquad(teams, "home", []).onPitch).toHaveLength(n);
  });

  it("rejects a format that is not supported", () => {
    expect(validateRules(normalizeRules({ playersPerSide: 8 }))).not.toEqual([]);
  });
});

describe("minimum players", () => {
  it("is fine exactly AT the minimum", () => {
    const { teams, tournament } = makeMatch({ rules: { minPlayersToContinue: 3 } });
    // 5 -> 3 players
    expect(getMatchIssues(teams, reds("away", 2, away), tournament.rules)).toEqual([]);
  });

  it("flags a team that falls BELOW the minimum, naming the team", () => {
    const { teams, tournament } = makeMatch({ rules: { minPlayersToContinue: 3 } });
    // 5 -> 2 players
    const issues = getMatchIssues(teams, reds("away", 3, away), tournament.rules);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "below_minimum", side: "away" });
    expect(issues[0].message).toContain("Away FC");
  });

  it("the minimum is configurable per tournament", () => {
    const strict = makeMatch({ rules: { minPlayersToContinue: 4 } });
    const events = reds("home", 2, home); // 5 -> 3
    expect(getMatchIssues(strict.teams, events, strict.tournament.rules)).toHaveLength(1);

    const relaxed = makeMatch({ rules: { minPlayersToContinue: 2 } });
    expect(getMatchIssues(relaxed.teams, events, relaxed.tournament.rules)).toEqual([]);
  });

  it("works for 11-a-side with its own minimum", () => {
    const { teams, tournament } = makeMatch({ playersPerSide: 11, rules: { minPlayersToContinue: 7 } });
    expect(getMatchIssues(teams, reds("home", 4, home), tournament.rules)).toEqual([]); // 7 left
    expect(getMatchIssues(teams, reds("home", 5, home), tournament.rules)).toHaveLength(1); // 6 left
  });

  it("flags BOTH teams if both are below the minimum", () => {
    const { teams, tournament } = makeMatch();
    const events = [...reds("home", 3, home), ...reds("away", 3, away)];
    expect(getMatchIssues(teams, events, tournament.rules)).toHaveLength(2);
  });

  it("the issue goes away when the cause is undone (voided)", () => {
    const { teams, tournament } = makeMatch();
    const events = reds("away", 3, away);
    events[2] = { ...events[2], voidedAt: "T" };
    expect(getMatchIssues(teams, events, tournament.rules)).toEqual([]);
  });

  it("a short lineup blocks the match before it starts", () => {
    const { teams, tournament } = makeMatch({ playersPerSide: 5, rules: { minPlayersToContinue: 3 } });
    teams.home.players.forEach((p, i) => (p.bench = i >= 2)); // only 2 starters
    expect(getMatchIssues(teams, [], tournament.rules)[0]).toMatchObject({ code: "below_minimum", side: "home" });
  });

  it("flags a lineup bigger than the format allows", () => {
    const { teams, tournament } = makeMatch({ playersPerSide: 5 });
    teams.home.players.forEach((p) => (p.bench = false)); // 8 starters
    expect(getMatchIssues(teams, [], tournament.rules)[0]).toMatchObject({ code: "above_format", side: "home" });
  });
});

describe("rules validation", () => {
  it("defaults are valid", () => {
    expect(validateRules(normalizeRules())).toEqual([]);
  });

  it("rejects a minimum bigger than the team size", () => {
    expect(validateRules(normalizeRules({ playersPerSide: 5, minPlayersToContinue: 6 }))).not.toEqual([]);
  });

  it("rejects an unknown red-card rule", () => {
    expect(validateRules(normalizeRules({ redCardReplacement: "whenever" }))).not.toEqual([]);
  });

  it("describes the rules in plain words", () => {
    expect(describeRules(normalizeRules({ playersPerSide: 7, minPlayersToContinue: 4 }))).toBe(
      "7-a-side · minimum 4 players · no replacement after a red card"
    );
  });

  it("default: no replacement after a red card", () => {
    expect(normalizeRules().redCardReplacement).toBe("none");
  });
});

describe("red-card replacement rule", () => {
  it("default (none): the team can NOT bring on a replacement", () => {
    const { teams, tournament } = makeMatch();
    const squad = getSquad(teams, "home", [ev("red_card", "home", home(1))]);
    expect(squad.pendingReplacements).toBe(1);
    expect(canReplaceNow(squad, tournament.rules)).toBe(false);
  });

  it("immediate: the team may fill the slot, once per red card", () => {
    const { teams, tournament } = makeMatch({ rules: { redCardReplacement: "immediate" } });
    const red = ev("red_card", "home", home(1));

    let squad = getSquad(teams, "home", [red]);
    expect(canReplaceNow(squad, tournament.rules)).toBe(true);

    const replaced = ev("replacement", "home", null, { playerInId: home(6) });
    squad = getSquad(teams, "home", [red, replaced]);
    expect(squad.onPitch).toHaveLength(5);
    expect(squad.onPitch.map((p) => p.id)).toContain(home(6));
    expect(canReplaceNow(squad, tournament.rules)).toBe(false); // slot already filled
  });

  it("immediate: no replacement possible without a red card", () => {
    const { teams, tournament } = makeMatch({ rules: { redCardReplacement: "immediate" } });
    expect(canReplaceNow(getSquad(teams, "home", []), tournament.rules)).toBe(false);
  });

  it("immediate: no replacement when the bench is empty", () => {
    const { teams, tournament } = makeMatch({ bench: 0, rules: { redCardReplacement: "immediate" } });
    const squad = getSquad(teams, "home", [ev("red_card", "home", home(1))]);
    expect(canReplaceNow(squad, tournament.rules)).toBe(false);
  });

  it("a replacement can bring a team back up to the minimum", () => {
    const { teams, tournament } = makeMatch({ rules: { redCardReplacement: "immediate", minPlayersToContinue: 3 } });
    const events = [
      ev("red_card", "home", home(1)),
      ev("red_card", "home", home(2)),
      ev("red_card", "home", home(3)),
    ];
    expect(getMatchIssues(teams, events, tournament.rules)).toHaveLength(1); // 2 players
    events.push(ev("replacement", "home", null, { playerInId: home(6) }));
    expect(getMatchIssues(teams, events, tournament.rules)).toEqual([]); // 3 players
  });
});
