import { useState } from "react";
import { FIXTURE_STATUS } from "../../config/fixtures";
import { datePart, formatDate, timePart, toMinutes } from "../../fixtures/time";
import { blockedInterval, intervalsOverlap } from "../../fixtures/validation";
import { teamLabel } from "../../fixtures/labels";

const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;

// "Pitch schedule" card from the design: one row per pitch, one column per hour.
// A slot turns red when two matches on that pitch really overlap.
export default function PitchTimeline({ fixtures, ctx, preferredDate }) {
  const { teams, pitches } = ctx;
  const active = fixtures.filter((f) => f.status !== FIXTURE_STATUS.CANCELLED && f.startsAt && f.pitchId);
  const dates = [...new Set(active.map((f) => datePart(f.startsAt)))].sort();
  const [picked, setPicked] = useState("");
  const date = dates.includes(preferredDate) ? preferredDate : dates.includes(picked) ? picked : dates[0];

  const onDay = active.filter((f) => datePart(f.startsAt) === date);
  const intervals = new Map(onDay.map((f) => [f.id, blockedInterval(f)]));
  const clashing = new Set();
  for (const a of onDay) {
    for (const b of onDay) {
      if (a.id < b.id && a.pitchId === b.pitchId && intervalsOverlap(intervals.get(a.id), intervals.get(b.id))) {
        clashing.add(a.id);
        clashing.add(b.id);
      }
    }
  }

  const starts = onDay.map((f) => Math.floor(timeOf(f) / 60));
  const ends = onDay.map((f) => Math.floor((intervals.get(f.id).playEnd - 1 - dayStart(f)) / 60));
  const first = Math.min(...starts);
  const last = Math.max(...ends, ...starts);
  const hours = onDay.length ? Array.from({ length: last - first + 1 }, (_, i) => first + i) : [];

  return (
    <section className="table-card timeline-card" aria-label="Pitch schedule">
      <div className="timeline-head">
        <h3>Pitch schedule{date ? ` · ${formatDate(`${date}T00:00`).replace(/ \d{4}$/, "")}` : ""}</h3>
        {dates.length > 1 && !dates.includes(preferredDate) && (
          <select aria-label="Timeline date" value={date} onChange={(e) => setPicked(e.target.value)}>
            {dates.map((d) => (
              <option key={d} value={d}>
                {formatDate(`${d}T00:00`)}
              </option>
            ))}
          </select>
        )}
      </div>

      {onDay.length === 0 ? (
        <p className="timeline-empty">Schedule some fixtures to see them on the pitches here.</p>
      ) : (
        <div className="timeline-scroll">
          <div className="timeline-grid" style={{ "--cols": hours.length }}>
            <div />
            {hours.map((h) => (
              <div key={h} className="timeline-hour">
                {hourLabel(h)}
              </div>
            ))}
            {pitches.map((p) => (
              <PitchRow key={p.id} pitch={p} hours={hours} fixtures={onDay.filter((f) => f.pitchId === p.id)} clashing={clashing} teams={teams} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const dayStart = (f) => toMinutes(`${datePart(f.startsAt)}T00:00`);
const timeOf = (f) => toMinutes(f.startsAt) - dayStart(f);

function PitchRow({ pitch, hours, fixtures, clashing, teams }) {
  return (
    <>
      <div className="timeline-pitch">{pitch.name}</div>
      {hours.map((h) => {
        const inHour = fixtures.filter((f) => Math.floor(timeOf(f) / 60) === h);
        if (inHour.length === 0) return <div key={h} className="slot slot-free">Free</div>;
        const bad = inHour.some((f) => clashing.has(f.id));
        return (
          <div key={h} className={`slot ${bad ? "slot-conflict" : "slot-booked"}`}>
            {inHour.map((f) => (
              <span key={f.id}>
                {timePart(f.startsAt)} · {teamLabel(f, "home", teams)} vs {teamLabel(f, "away", teams)}
              </span>
            ))}
          </div>
        );
      })}
    </>
  );
}
