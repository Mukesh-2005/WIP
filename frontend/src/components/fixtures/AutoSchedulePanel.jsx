import { useState } from "react";

// Places every pending fixture in the earliest free slot (no clashes possible).
export default function AutoSchedulePanel({ tournament, pendingCount, onRun }) {
  const [startDate, setStartDate] = useState(tournament.startDate);
  const [dayStart, setDayStart] = useState("09:00");
  const [dayEnd, setDayEnd] = useState("21:00");

  return (
    <section className="dialog-section" aria-label="Auto-schedule">
      <p className="hint">
        Fills the date, time and pitch of the <strong>{pendingCount}</strong> pending fixture
        {pendingCount === 1 ? "" : "s"} in the earliest free slots. You can still edit any of them afterwards.
      </p>
      <label>
        First day
        <input
          type="date"
          value={startDate}
          min={tournament.startDate}
          max={tournament.endDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </label>
      <div className="field-row">
        <label>
          Day starts
          <input type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} />
        </label>
        <label>
          Day ends
          <input type="time" value={dayEnd} onChange={(e) => setDayEnd(e.target.value)} />
        </label>
      </div>
      <button
        className="btn btn-primary"
        disabled={pendingCount === 0 || !startDate || !dayStart || !dayEnd || dayStart >= dayEnd}
        onClick={() => onRun({ startDate, dayStart, dayEnd })}
      >
        Schedule pending fixtures
      </button>
    </section>
  );
}
