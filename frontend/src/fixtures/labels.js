// Display name for one side of a fixture: the team name, or its placeholder
// ("Winner of Semi-final 1", "1st in league") while the team is not known yet.
export const teamLabel = (f, side, teams) => {
  const id = side === "home" ? f.homeTeamId : f.awayTeamId;
  const label = side === "home" ? f.homeLabel : f.awayLabel;
  return id != null ? (teams.find((t) => t.id === id)?.name ?? `Team ${id}`) : (label ?? "TBD");
};
