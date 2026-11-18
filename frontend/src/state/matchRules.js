import { getSquad } from "./matchReducer";
import { RED_CARD_REPLACEMENT } from "../config/rules";

const SIDES = ["home", "away"];

// Problems that stop the match from starting or continuing.
// The match is NEVER forfeited automatically; the organiser has to resolve it
// (e.g. undo a mistaken event) or end the match themselves.
export function getMatchIssues(teams, events, rules, sportId = "football") {
  const issues = [];
  for (const side of SIDES) {
    const count = getSquad(teams, side, events, sportId).onPitch.length;
    const name = teams[side].name;

    if (count < rules.minPlayersToContinue) {
      issues.push({
        code: "below_minimum",
        side,
        message: `${name} has ${count} player${count === 1 ? "" : "s"} on the pitch. The minimum is ${rules.minPlayersToContinue}.`,
      });
    }
    if (count > rules.playersPerSide) {
      issues.push({
        code: "above_format",
        side,
        message: `${name} has ${count} players on the pitch, more than the ${rules.playersPerSide}-a-side format allows.`,
      });
    }
  }
  return issues;
}

// May this team bring on a replacement for a sent-off player right now?
export function canReplaceNow(squad, rules) {
  return (
    rules.redCardReplacement === RED_CARD_REPLACEMENT.IMMEDIATE &&
    squad.pendingReplacements > 0 &&
    squad.bench.length > 0
  );
}
