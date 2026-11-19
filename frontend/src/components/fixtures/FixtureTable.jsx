import { FIXTURE_STATUS, STATUS_LABELS } from "../../config/fixtures";
import { formatDate, formatTimeRange, timePart } from "../../fixtures/time";
import { sortFixtures } from "../../fixtures/scheduling";
import { openMatchBlocker } from "../../fixtures/matchFromFixture";
import { teamLabel } from "../../fixtures/labels";

// "Sat 5 Dec · 5:00 PM" style (as in the design), with the end time added.
function whenText(f) {
  if (!f.startsAt) return "Not scheduled";
  const [h, m] = timePart(f.startsAt).split(":").map(Number);
  const clock = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  const day = formatDate(f.startsAt).replace(/^(\w{3}), (\d+ \w+) \d{4}$/, "$1 $2");
  return `${day} · ${clock}`;
}

// The fixtures table from the design: Match | Round | Date and time | Pitch | Status | actions.
// On a phone every row turns into a small card (the labels come from data-label).
export default function FixtureTable({ fixtures, allFixtures, conflictIds, ctx, onEdit, onCancel, onOpen }) {
  const { teams, pitches } = ctx;

  if (allFixtures.length === 0) {
    return <p className="empty-card">No fixtures yet. Press "Generate fixtures" to create them from the approved teams.</p>;
  }
  if (fixtures.length === 0) {
    return <p className="empty-card">No fixtures match these filters.</p>;
  }

  return (
    <div className="table-card">
      <table className="fixtures-table">
        <thead>
          <tr>
            <th>Match</th>
            <th>Round</th>
            <th>Date and time</th>
            <th>Pitch</th>
            <th>Status</th>
            <th>
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortFixtures(fixtures).map((f) => {
            const cancelled = f.status === FIXTURE_STATUS.CANCELLED;
            const completed = f.status === FIXTURE_STATUS.COMPLETED;
            const conflict = conflictIds.has(f.id);
            const pitch = pitches.find((p) => p.id === f.pitchId);
            const blocker = openMatchBlocker(f, teams);
            const badge = conflict ? "conflict" : f.status;
            return (
              <tr key={f.id} data-testid={`fixture-${f.id}`} className={`fixture fixture-${f.status} ${conflict ? "row-conflict" : ""}`}>
                <td data-label="Match" className="cell-match">
                  <span className={f.homeTeamId == null ? "tbd" : ""}>{teamLabel(f, "home", teams)}</span>{" "}
                  <span className="vs">{completed ? `${f.result.home} - ${f.result.away}` : "vs"}</span>{" "}
                  <span className={f.awayTeamId == null ? "tbd" : ""}>{teamLabel(f, "away", teams)}</span>
                </td>
                <td data-label="Round">
                  {f.roundLabel}
                  <span className="cell-note">{f.matchLabel}</span>
                </td>
                <td data-label="Date and time">
                  {whenText(f)}
                  {f.startsAt && <span className="cell-note">{formatTimeRange(f.startsAt, f.durationMinutes)}</span>}
                </td>
                <td data-label="Pitch">{pitch ? pitch.name : "—"}</td>
                <td data-label="Status">
                  <span className={`pill pill-${badge}`}>{conflict ? "Conflict" : STATUS_LABELS[f.status]}</span>
                </td>
                <td data-label="" className="cell-actions">
                  {!cancelled && !completed && (
                    <button className="link-btn" onClick={() => onEdit(f.id)}>
                      Edit
                    </button>
                  )}
                  {!cancelled && !completed && (
                    <button className="link-btn link-danger" onClick={() => onCancel(f.id)}>
                      Cancel fixture
                    </button>
                  )}
                  {!cancelled && (
                    <button className="link-btn" onClick={() => onOpen(f.id)} disabled={Boolean(blocker)} title={blocker ?? ""}>
                      {completed ? "View match" : "Open match"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
