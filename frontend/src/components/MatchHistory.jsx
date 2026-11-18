import { formatTime } from "../hooks/useMatchTimer";
import { activeEvents } from "../state/matchReducer";

// Lists finished matches that were saved through matchRepository.
export default function MatchHistory({ matches }) {
  return (
    <section className="card history" aria-label="Match history">
      <h3>Match history</h3>

      {matches.length === 0 ? (
        <p className="hint">No finished matches saved yet.</p>
      ) : (
        <ul>
          {matches.map((m) => (
            <li key={m.id}>
              <strong>
                {m.homeTeam.name} {m.score.home} - {m.score.away} {m.awayTeam.name}
              </strong>
              <span>
                {m.endedAt ? new Date(m.endedAt).toLocaleString() : "Date unknown"} ·{" "}
                {formatTime(m.clockSeconds)} · {activeEvents(m.events).length} events
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
