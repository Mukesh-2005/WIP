// Looks up a player's name from a side ("home" | "away") + player id.
// Shared by the timeline and the full-time summary.
export function playerName(teams, side, playerId) {
  return teams[side].players.find((p) => p.id === playerId)?.name ?? "Unknown";
}
