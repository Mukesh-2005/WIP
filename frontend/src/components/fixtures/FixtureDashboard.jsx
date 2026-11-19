import { fixtureStats } from "../../fixtures/scheduling";

const CARDS = [
  { key: "total", label: "Total fixtures", status: "" },
  { key: "scheduled", label: "Scheduled", status: "scheduled" },
  { key: "completed", label: "Completed", status: "completed" },
  { key: "pending", label: "Pending", status: "pending" },
  { key: "cancelled", label: "Cancelled", status: "cancelled" },
];

// Clicking a card filters the list by that status.
export default function FixtureDashboard({ fixtures, activeStatus, onPickStatus }) {
  const stats = fixtureStats(fixtures);
  return (
    <section className="stats" aria-label="Fixture dashboard">
      {CARDS.map(({ key, label, status }) => (
        <button
          key={key}
          className={`stat stat-${key} ${activeStatus === status ? "stat-active" : ""}`}
          onClick={() => onPickStatus(status)}
          aria-pressed={activeStatus === status}
        >
          <span className="stat-value" data-testid={`stat-${key}`}>
            {stats[key]}
          </span>
          <span className="stat-label">{label}</span>
        </button>
      ))}
    </section>
  );
}
