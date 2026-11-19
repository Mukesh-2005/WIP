import { FIXTURE_STATUS, STATUS_LABELS } from "../../config/fixtures";
import { formatDate, formatTimeRange } from "../../fixtures/time";
import { sortFixtures } from "../../fixtures/scheduling";
import { teamLabel } from "../../fixtures/labels";
import { Logo } from "../AppShell";

// The public tournament page (design: "01 Public tournament page"): green header
// and hero, then the fixtures. It shows ONLY the published copy, never the draft.
export default function PublicTournamentPage({ tournament, published, teams, pitches, onBack }) {
  return (
    <div className="public-site">
      <header className="public-header">
        <Logo className="logo-dark" />
        <span className="public-links">Tournaments · Fixtures · Results · Standings</span>
        <button className="dbtn" onClick={onBack}>
          ← Organiser view
        </button>
      </header>

      <section className="public-hero">
        <h1>{tournament.name}</h1>
        <p>
          Football · {teams.filter((t) => t.approvalStatus === "approved").length} teams ·{" "}
          {formatDate(`${tournament.startDate}T00:00`).replace(/^\w{3}, /, "")} to {formatDate(`${tournament.endDate}T00:00`).replace(/^\w{3}, /, "")}
        </p>
      </section>

      <main className="public-body">
        {!published ? (
          <p className="empty-card" data-testid="not-published">
            The fixtures have not been published yet. Please check back soon.
          </p>
        ) : (
          <PublishedFixtures published={published} teams={teams} pitches={pitches} />
        )}
      </main>
    </div>
  );
}

function PublishedFixtures({ published, teams, pitches }) {
  const groups = [];
  for (const f of sortFixtures(published.fixtures)) {
    let group = groups.find((g) => g.key === f.roundKey);
    if (!group) {
      group = { key: f.roundKey, label: f.roundLabel, items: [] };
      groups.push(group);
    }
    group.items.push(f);
  }
  const pitchName = (id) => pitches.find((p) => p.id === id)?.name;

  return (
    <>
      <p className="hint">Last updated {new Date(published.publishedAt).toLocaleString()}</p>
      {groups.map((g) => (
        <section key={g.key} className="public-card" aria-label={g.label}>
          <h3>{g.label}</h3>
          <ul>
            {g.items.map((f) => (
              <li key={f.id} className={`public-fixture fixture-${f.status}`} data-testid={`public-${f.id}`}>
                <span className="public-round">
                  {f.matchLabel}
                  {f.status !== FIXTURE_STATUS.SCHEDULED && ` · ${STATUS_LABELS[f.status]}`}
                </span>
                <strong>
                  <span className={f.homeTeamId == null ? "tbd" : ""}>{teamLabel(f, "home", teams)}</span>{" "}
                  <span className="vs">{f.status === FIXTURE_STATUS.COMPLETED ? `${f.result.home} - ${f.result.away}` : "vs"}</span>{" "}
                  <span className={f.awayTeamId == null ? "tbd" : ""}>{teamLabel(f, "away", teams)}</span>
                </strong>
                <span className="public-when">
                  {f.startsAt && f.pitchId
                    ? `${formatDate(f.startsAt)} · ${formatTimeRange(f.startsAt, f.durationMinutes)} · ${pitchName(f.pitchId)}`
                    : "To be confirmed"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
