import { formatTime } from "../hooks/useMatchTimer";
import { getSport } from "../config/sports";
import { summarizeEvents, activeEvents } from "../state/matchReducer";
import { playerName } from "../utils/playerName";

// Shown after the match ends. Everything here is derived from `events`.
export default function FullTimeSummary({ teams, sportId, score, seconds, events, issues = [] }) {
  const eventTypes = getSport(sportId).eventTypes;
  const active = activeEvents(events);
  const stats = summarizeEvents(active, sportId);

  let headline = "Match drawn";
  if (score.home > score.away) headline = `${teams.home.name} win`;
  if (score.away > score.home) headline = `${teams.away.name} win`;

  const goals = active.filter((e) => eventTypes[e.type]?.scores);

  const rows = [
    { label: "Yellow cards", key: "yellow" },
    { label: "Red cards", key: "red" },
    { label: "Substitutions", key: "subs" },
  ];

  return (
    <section className="card summary" aria-label="Full time summary">
      <p className="summary-kicker">Full time · {formatTime(seconds)}</p>
      <h3 className="summary-headline">{headline}</h3>
      <p className="summary-score">
        {teams.home.name} {score.home} - {score.away} {teams.away.name}
      </p>

      {issues.length > 0 && (
        <p className="warning">
          This match was ended while a team was below the minimum number of players. No forfeit
          has been applied; the organiser decides the outcome.
        </p>
      )}

      <h4>Goals</h4>
      {goals.length === 0 ? (
        <p className="hint">No goals scored.</p>
      ) : (
        <ul className="summary-goals">
          {goals.map((e) => (
            <li key={e.id}>
              <span className="event-time">{formatTime(e.second)}</span>
              {playerName(teams, e.side, e.playerId)}
              {e.type === "own_goal" ? " (own goal)" : ""} · {teams[e.side].name}
            </li>
          ))}
        </ul>
      )}

      <table className="summary-table">
        <thead>
          <tr>
            <th></th>
            <th>{teams.home.name}</th>
            <th>{teams.away.name}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{stats.home[r.key]}</td>
              <td>{stats.away[r.key]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
