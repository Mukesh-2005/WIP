// Tournament-level match rules. Nothing about formats or red-card handling
// is hardcoded in the match logic; it all comes from this object.
// Later the backend will store these on the tournament record.

export const SUPPORTED_FORMATS = [5, 6, 7, 11]; // players per side

export const RED_CARD_REPLACEMENT = {
  NONE: "none", // sent-off player is never replaced (default)
  IMMEDIATE: "immediate", // team may bring on a bench player right away
};

// NOTE: minPlayersToContinue = 3 is a placeholder default, not a confirmed rule.
export const DEFAULT_RULES = {
  playersPerSide: 5,
  minPlayersToContinue: 3,
  redCardReplacement: RED_CARD_REPLACEMENT.NONE,
};

export function normalizeRules(input = {}) {
  return { ...DEFAULT_RULES, ...input };
}

// Returns a list of problems (empty list = valid).
export function validateRules(rules) {
  const errors = [];
  if (!SUPPORTED_FORMATS.includes(rules.playersPerSide)) {
    errors.push(`playersPerSide must be one of ${SUPPORTED_FORMATS.join(", ")}`);
  }
  if (
    !Number.isInteger(rules.minPlayersToContinue) ||
    rules.minPlayersToContinue < 1 ||
    rules.minPlayersToContinue > rules.playersPerSide
  ) {
    errors.push("minPlayersToContinue must be a whole number from 1 up to playersPerSide");
  }
  if (!Object.values(RED_CARD_REPLACEMENT).includes(rules.redCardReplacement)) {
    errors.push(`redCardReplacement must be one of ${Object.values(RED_CARD_REPLACEMENT).join(", ")}`);
  }
  return errors;
}

export function describeRules(rules) {
  const replacement =
    rules.redCardReplacement === RED_CARD_REPLACEMENT.IMMEDIATE
      ? "red-card replacement allowed"
      : "no replacement after a red card";
  return `${rules.playersPerSide}-a-side · minimum ${rules.minPlayersToContinue} players · ${replacement}`;
}
