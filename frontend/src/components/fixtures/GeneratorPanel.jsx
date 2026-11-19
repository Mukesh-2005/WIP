import { FIXTURE_FORMATS, FORMAT_LABELS } from "../../config/fixtures";
import { defaultQualifiers } from "../../fixtures/generator";

// A short sentence so the organiser sees what will be generated.
function preview(count, settings) {
  if (count < 2) return null;
  const odd = count % 2 === 1;
  const leagueMatches = (count * (count - 1)) / 2;
  const leagueRounds = odd ? count : count - 1;
  const byeNote = odd ? " One team rests (bye) in every round." : "";

  if (settings.format === FIXTURE_FORMATS.LEAGUE) {
    return `${leagueMatches} matches in ${leagueRounds} rounds.${byeNote}`;
  }
  if (settings.format === FIXTURE_FORMATS.KNOCKOUT) {
    const size = 2 ** Math.ceil(Math.log2(count));
    return `${count - 1} matches.${size > count ? ` ${size - count} team(s) get a bye into round 2.` : ""}`;
  }
  const q = settings.qualifiers ?? defaultQualifiers(count);
  return `${leagueMatches} league matches in ${leagueRounds} rounds + ${q - 1} knockout matches for the top ${q}.${byeNote}`;
}

export default function GeneratorPanel({ settings, approvedCount, hasFixtures, onChange, onGenerate }) {
  const set = (patch) => onChange({ ...settings, ...patch });
  const isMixed = settings.format === FIXTURE_FORMATS.LEAGUE_KNOCKOUT;
  const text = preview(approvedCount, settings);

  return (
    <section className="dialog-section" aria-label="Generate fixtures">
      <p className="hint">
        Uses the <strong>{approvedCount}</strong> registered and approved team{approvedCount === 1 ? "" : "s"} only.
      </p>

      <label>
        Format
        <select value={settings.format} onChange={(e) => set({ format: e.target.value })}>
          {Object.entries(FORMAT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {isMixed && (
        <label>
          Teams going into the knockout
          <input
            type="number"
            min="2"
            max={approvedCount}
            placeholder={`Automatic (${approvedCount >= 3 ? defaultQualifiers(approvedCount) : "-"})`}
            value={settings.qualifiers ?? ""}
            onChange={(e) => set({ qualifiers: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>
      )}

      <div className="field-row">
        <label>
          Match duration (min)
          <input
            type="number"
            min="1"
            value={Number.isNaN(settings.durationMinutes) ? "" : settings.durationMinutes}
            onChange={(e) => set({ durationMinutes: e.target.value === "" ? NaN : Number(e.target.value) })}
          />
        </label>
        <label>
          Break (min)
          <input
            type="number"
            min="0"
            value={Number.isNaN(settings.breakMinutes) ? "" : settings.breakMinutes}
            onChange={(e) => set({ breakMinutes: e.target.value === "" ? NaN : Number(e.target.value) })}
          />
        </label>
      </div>

      {text && <p className="hint preview">{text}</p>}

      <button className="btn btn-primary" onClick={onGenerate} disabled={approvedCount < 2}>
        {hasFixtures ? "Regenerate" : "Generate"}
      </button>
      {approvedCount < 2 && <p className="hint">At least 2 approved teams are needed to generate fixtures.</p>}
    </section>
  );
}
