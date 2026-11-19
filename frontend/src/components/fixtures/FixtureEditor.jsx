import { useEffect, useMemo, useState } from "react";
import { TEAM_APPROVAL } from "../../config/fixtures";
import { composeStartsAt, datePart, timePart } from "../../fixtures/time";
import { deriveStatus } from "../../fixtures/scheduling";
import { validateFixtureSchedule } from "../../fixtures/validation";

const asNumber = (v) => (v === "" ? NaN : Number(v));

// Edit teams, date, time, pitch, duration and break. The problems list is
// recalculated on every keystroke, so a clash is shown before saving.
export default function FixtureEditor({ fixture, allFixtures, ctx, onSave, onClose }) {
  const [form, setForm] = useState({
    homeTeamId: fixture.homeTeamId ?? "",
    awayTeamId: fixture.awayTeamId ?? "",
    date: datePart(fixture.startsAt),
    time: timePart(fixture.startsAt),
    pitchId: fixture.pitchId ?? "",
    durationMinutes: fixture.durationMinutes,
    breakMinutes: fixture.breakMinutes,
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const startsAt = composeStartsAt(form.date, form.time);
  const incomplete = Boolean(form.date) !== Boolean(form.time);

  const errors = useMemo(() => {
    const candidate = {
      ...fixture,
      homeTeamId: form.homeTeamId === "" ? null : Number(form.homeTeamId),
      awayTeamId: form.awayTeamId === "" ? null : Number(form.awayTeamId),
      startsAt,
      pitchId: form.pitchId || null,
      durationMinutes: asNumber(form.durationMinutes),
      breakMinutes: asNumber(form.breakMinutes),
    };
    candidate.status = deriveStatus({ ...candidate, status: "pending" });
    const list = validateFixtureSchedule(candidate, allFixtures, ctx).map((e) => e.message);
    if (incomplete) list.unshift("Enter both a date and a time, or clear both.");
    return list;
  }, [form, startsAt, incomplete, fixture, allFixtures, ctx]);

  // Approved teams, plus the current team if it is no longer approved (so the error can explain).
  const teamOptions = ctx.teams.filter(
    (t) => t.approvalStatus === TEAM_APPROVAL.APPROVED || t.id === fixture.homeTeamId || t.id === fixture.awayTeamId
  );

  function submit(e) {
    e.preventDefault();
    if (errors.length) return;
    onSave({
      homeTeamId: form.homeTeamId,
      awayTeamId: form.awayTeamId,
      startsAt,
      pitchId: form.pitchId,
      durationMinutes: form.durationMinutes,
      breakMinutes: form.breakMinutes,
    });
  }

  const teamSelect = (field, label) => (
    <label>
      {label}
      <select value={form[field]} onChange={(e) => set({ [field]: e.target.value })}>
        <option value="">{label === "Home team" ? fixture.homeLabel ?? "TBD" : fixture.awayLabel ?? "TBD"} (not assigned)</option>
        {teamOptions.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.approvalStatus !== TEAM_APPROVAL.APPROVED ? " (not approved)" : ""}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 id="editor-title">
          {fixture.matchLabel} <span className="hint">· {fixture.roundLabel}</span>
        </h3>

        <div className="field-row">
          {teamSelect("homeTeamId", "Home team")}
          {teamSelect("awayTeamId", "Away team")}
        </div>

        <div className="field-row">
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </label>
          <label>
            Time
            <input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} />
          </label>
        </div>

        <label>
          Pitch
          <select value={form.pitchId} onChange={(e) => set({ pitchId: e.target.value })}>
            <option value="">No pitch yet</option>
            {ctx.pitches.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="field-row">
          <label>
            Duration (min)
            <input
              type="number"
              min="1"
              value={Number.isNaN(form.durationMinutes) ? "" : form.durationMinutes}
              onChange={(e) => set({ durationMinutes: e.target.value })}
            />
          </label>
          <label>
            Break after (min)
            <input
              type="number"
              min="0"
              value={Number.isNaN(form.breakMinutes) ? "" : form.breakMinutes}
              onChange={(e) => set({ breakMinutes: e.target.value })}
            />
          </label>
        </div>

        {errors.length > 0 && (
          <ul className="banner banner-warning editor-errors" role="alert">
            {errors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="btn btn-primary" disabled={errors.length > 0}>
            Save fixture
          </button>
        </div>
      </form>
    </div>
  );
}
