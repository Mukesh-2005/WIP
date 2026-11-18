// Event types per sport. The rest of the app reads this registry instead of
// hardcoding "goal", "red_card", ... so adding a sport means adding an entry here.
//
// kind:
//   "player"       -> one player is involved
//   "substitution" -> one player off, one player on
//   "replacement"  -> a player comes on to fill a slot left by a red card
// scores: "self" (team scores) | "opponent" (other team scores) | undefined (no score change)
// sendsOff: the player leaves the pitch and cannot return
export const SPORTS = {
  football: {
    id: "football",
    label: "Football / Futsal",
    eventTypes: {
      goal: { label: "Goal", icon: "⚽", kind: "player", scores: "self" },
      own_goal: { label: "Own Goal", icon: "🥅", kind: "player", scores: "opponent" },
      yellow_card: { label: "Yellow Card", icon: "🟨", kind: "player" },
      red_card: { label: "Red Card", icon: "🟥", kind: "player", sendsOff: true },
      substitution: { label: "Substitution", icon: "🔁", kind: "substitution" },
      replacement: {
        label: "Replacement (after red card)",
        icon: "➕",
        kind: "replacement",
      },
    },
  },
};

export function getSport(sportId) {
  const sport = SPORTS[sportId];
  if (!sport) throw new Error(`Unknown sport: ${sportId}`);
  return sport;
}

export const otherSide = (side) => (side === "home" ? "away" : "home");
