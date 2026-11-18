import { formatTime } from "../hooks/useMatchTimer";
import { getSport } from "../config/sports";
import { playerName } from "../utils/playerName";

// `events` must be the ACTIVE events (undone ones are kept in history but not shown).
export default function Timeline({ events, teams, sportId, onUndo, canUndo }) {
  const eventTypes = getSport(sportId).eventTypes;

  function describe(e) {
    const kind = eventTypes[e.type]?.kind;
    if (kind === "substitution") {
      return `${playerName(teams, e.side, e.playerId)} → ${playerName(teams, e.side, e.playerInId)}`;
    }
    if (kind === "replacement") {
      return `${playerName(teams, e.side, e.playerInId)} comes on`;
    }
    return playerName(teams, e.side, e.playerId);
  }

  return (
    <section className="card timeline" aria-label="Match events">
      <div className="timeline-header">
        <h3>Match events</h3>
        <button className="btn btn-ghost" onClick={onUndo} disabled={!canUndo}>
          Undo last event
        </button>
      </div>

      {events.length === 0 && <p className="hint">No events yet.</p>}

      <ul>
        {/* copy first: reverse() edits the array it is called on */}
        {[...events].reverse().map((e) => (
          <li key={e.id} className={`event event-${e.side}`}>
            <span className="event-time">{formatTime(e.second)}</span>
            <div className="event-body">
              <strong>
                {eventTypes[e.type]?.icon} {eventTypes[e.type]?.label ?? e.type}
              </strong>
              <span>
                {teams[e.side].name} · {describe(e)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
