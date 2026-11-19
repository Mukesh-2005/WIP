import { STATUS_LABELS } from "../../config/fixtures";
import { datePart, formatDate } from "../../fixtures/time";
import { sortFixtures } from "../../fixtures/scheduling";

// Filter "pills" from the design. The options come from the fixtures that
// exist, so you never pick an empty choice. `shown` is the count after filtering.
export default function FixtureFilters({ fixtures, pitches, filters, shown, onChange }) {
  const rounds = [];
  for (const f of sortFixtures(fixtures)) {
    if (!rounds.some((r) => r.key === f.roundKey)) rounds.push({ key: f.roundKey, label: f.roundLabel });
  }
  const dates = [...new Set(fixtures.map((f) => datePart(f.startsAt)).filter(Boolean))].sort();
  const set = (patch) => onChange({ ...filters, ...patch });
  const active = Object.values(filters).some(Boolean);

  return (
    <section className="filters" aria-label="Filters">
      <label className="filter-pill">
        <span className="visually-hidden">Round</span>
        <select value={filters.roundKey} onChange={(e) => set({ roundKey: e.target.value })}>
          <option value="">All rounds</option>
          {rounds.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-pill">
        <span className="visually-hidden">Pitch</span>
        <select value={filters.pitchId} onChange={(e) => set({ pitchId: e.target.value })}>
          <option value="">All pitches</option>
          {pitches.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-pill">
        <span className="visually-hidden">Date</span>
        <select value={filters.date} onChange={(e) => set({ date: e.target.value })}>
          <option value="">All dates</option>
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatDate(`${d}T00:00`)}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-pill">
        <span className="visually-hidden">Status</span>
        <select value={filters.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">Status: all</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {active && (
        <button className="link-btn" onClick={() => onChange({ roundKey: "", date: "", pitchId: "", status: "" })}>
          Clear filters
        </button>
      )}
      <span className="filters-count">
        Showing {shown} of {fixtures.length} fixtures
      </span>
    </section>
  );
}
