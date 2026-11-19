import { useState } from "react";
import { FIXTURE_FORMATS, FIXTURE_STATUS } from "../../config/fixtures";
import { filterFixtures } from "../../fixtures/scheduling";
import { getEligibleTeams } from "../../fixtures/generator";
import { validateAllFixtures } from "../../fixtures/validation";
import alertIcon from "../../assets/design/alert-icon.svg";
import ConfirmModal from "../ConfirmModal";
import Dialog from "./Dialog";
import GeneratorPanel from "./GeneratorPanel";
import AutoSchedulePanel from "./AutoSchedulePanel";
import FixtureDashboard from "./FixtureDashboard";
import FixtureFilters from "./FixtureFilters";
import FixtureTable from "./FixtureTable";
import PitchTimeline from "./PitchTimeline";
import FixtureEditor from "./FixtureEditor";

const EMPTY_FILTERS = { roundKey: "", date: "", pitchId: "", status: "" };
const when = (iso) => (iso ? new Date(iso).toLocaleString() : "");
const FORMAT_WORDS = {
  [FIXTURE_FORMATS.LEAGUE]: "Round-robin",
  [FIXTURE_FORMATS.KNOCKOUT]: "Knockout",
  [FIXTURE_FORMATS.LEAGUE_KNOCKOUT]: "League + knockout",
};

// The organiser's Fixtures screen (design: "04 Fixture manager").
export default function FixtureManager({ store, onOpenMatch }) {
  const { base, state, ctx, actions } = store;
  const { fixtures, byes, settings, published, draftSavedAt, dirty } = state;

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [editingId, setEditingId] = useState(null);
  const [dialog, setDialog] = useState(null); // "generate" | "auto"
  const [confirm, setConfirm] = useState(null); // { kind: "publish" | "regenerate" | "cancel", id? }
  const [notice, setNotice] = useState(null); // { type: "success" | "error", messages: [] }

  const approvedCount = getEligibleTeams(base.teams).length;
  const visible = filterFixtures(fixtures, filters);
  const live = fixtures.filter((f) => f.status !== FIXTURE_STATUS.CANCELLED);
  const unscheduled = live.filter((f) => f.status === FIXTURE_STATUS.PENDING).length;
  const completed = fixtures.filter((f) => f.status === FIXTURE_STATUS.COMPLETED).length;
  const editing = fixtures.find((f) => f.id === editingId);

  // Anything that is wrong with the schedule right now (shown in the red banner).
  const problems = validateAllFixtures(fixtures, ctx);
  // both matches of a clash are marked, not just the first one
  const conflictIds = new Set(problems.flatMap((p) => [p.fixtureId, p.otherId]).filter(Boolean));

  const say = (type, ...messages) => setNotice({ type, messages });

  // ---- generating ----
  function runGenerate() {
    const result = actions.generate(settings);
    setFilters(EMPTY_FILTERS);
    if (result.ok) {
      const { fixtureCount, rounds, teamCount } = result.summary;
      say("success", `Generated ${fixtureCount} fixtures in ${rounds} rounds for ${teamCount} approved teams. Press "Save draft" to keep them.`);
    } else {
      say("error", result.error);
    }
  }

  function requestGenerate() {
    setDialog(null);
    if (fixtures.length > 0) {
      setConfirm({ kind: "regenerate" });
    } else {
      runGenerate();
    }
  }

  // ---- editing ----
  function saveEdit(changes) {
    const result = actions.updateFixture(editingId, changes);
    if (result.ok) {
      setEditingId(null);
      say("success", "Fixture saved.");
    }
    // when not ok the editor already shows the same messages, so it stays open
  }

  function runAutoSchedule(options) {
    setDialog(null);
    const result = actions.autoSchedule(options);
    if (result.unplaced.length === 0) {
      say("success", `Scheduled ${result.placed} fixtures with no conflicts.`);
    } else {
      say(
        "error",
        `Scheduled ${result.placed} fixtures, but ${result.unplaced.length} could not be placed (no free slot between the tournament dates and the daily hours). Add pitches, widen the daily hours or shorten the breaks.`
      );
    }
  }

  // ---- saving and publishing ----
  async function saveDraft() {
    await actions.saveDraft();
    say("success", "Draft saved.");
  }

  async function runPublish() {
    setConfirm(null);
    const result = await actions.publish();
    if (result.ok) say("success", "Fixtures published. They are now visible on the public tournament page.");
    else say("error", "Fixtures cannot be published yet:", ...result.errors.map((e) => e.message));
  }

  function runCancel() {
    const result = actions.cancelFixture(confirm.id);
    setConfirm(null);
    if (result.ok) say("success", "Fixture cancelled.");
    else say("error", ...result.errors.map((e) => e.message));
  }

  const cancelTarget = confirm?.kind === "cancel" ? fixtures.find((f) => f.id === confirm.id) : null;
  const subtitle = [
    base.tournament.name,
    FORMAT_WORDS[settings.format],
    `${approvedCount} teams`,
    `${live.length} matches`,
  ].join(" · ");

  return (
    <div className="fm">
      <header className="fm-top">
        <h2>Fixtures</h2>
        <span className={`pill ${published ? "pill-scheduled" : "pill-pending"}`} data-testid="publish-state">
          {published ? "Published" : "Draft schedule"}
        </span>
        <div className="fm-actions">
          <button className="dbtn" onClick={() => setDialog("auto")} disabled={fixtures.length === 0}>
            Auto-schedule
          </button>
          <button className="dbtn" onClick={() => setDialog("generate")}>
            Generate fixtures
          </button>
          <button className="dbtn" onClick={saveDraft} disabled={fixtures.length === 0 && !dirty}>
            Save draft
          </button>
          <button className="dbtn dbtn-primary" onClick={() => setConfirm({ kind: "publish" })} disabled={live.length === 0}>
            Publish schedule
          </button>
        </div>
      </header>

      <div className="fm-meta">
        <p className="fm-subtitle">{subtitle}</p>
        <span className="fm-save-state">{dirty ? "Unsaved changes" : draftSavedAt ? `Draft saved ${when(draftSavedAt)}` : ""}</span>
      </div>

      {problems.length > 0 && (
        <div className="conflict-banner" role="alert" data-testid="conflict-banner">
          <img src={alertIcon} alt="" width="12" height="12" />
          <div className="conflict-text">
            <strong>
              {conflictIds.size} fixture{conflictIds.size === 1 ? " has" : "s have"} a scheduling problem
            </strong>
            <span>{problems[0].message}</span>
          </div>
          <button className="dbtn dbtn-danger" onClick={() => setEditingId(problems[0].fixtureId)}>
            Resolve
          </button>
        </div>
      )}

      {notice && (
        <div className={`notice ${notice.type === "error" ? "notice-error" : "notice-ok"}`} role={notice.type === "error" ? "alert" : "status"}>
          <div>
            {notice.messages.length === 1 ? (
              <span>{notice.messages[0]}</span>
            ) : (
              <>
                <strong>{notice.messages[0]}</strong>
                <ul>
                  {notice.messages.slice(1).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <button className="link-btn" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <FixtureDashboard fixtures={fixtures} activeStatus={filters.status} onPickStatus={(status) => setFilters({ ...filters, status })} />
      <FixtureFilters fixtures={fixtures} pitches={base.pitches} filters={filters} shown={visible.length} onChange={setFilters} />

      <FixtureTable
        fixtures={visible}
        allFixtures={fixtures}
        conflictIds={conflictIds}
        ctx={ctx}
        onEdit={setEditingId}
        onCancel={(id) => setConfirm({ kind: "cancel", id })}
        onOpen={onOpenMatch}
      />

      {byes.length > 0 && (
        <details className="byes">
          <summary>Byes ({byes.length})</summary>
          <ul>
            {Object.entries(
              byes.reduce((acc, b) => {
                (acc[b.roundKey] ??= { label: b.roundLabel, names: [] }).names.push(
                  b.teamId != null ? (base.teams.find((t) => t.id === b.teamId)?.name ?? b.teamId) : b.label
                );
                return acc;
              }, {})
            ).map(([key, { label, names }]) => (
              <li key={key} className="bye-line">
                <strong>{label}:</strong> {names.join(", ")}{" "}
                <span>{key.startsWith("knockout") ? "(goes straight to the next round)" : "(rests this round)"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <PitchTimeline fixtures={fixtures} ctx={ctx} preferredDate={filters.date} />

      {dialog === "generate" && (
        <Dialog title="Generate fixtures" onClose={() => setDialog(null)}>
          <GeneratorPanel
            settings={settings}
            approvedCount={approvedCount}
            hasFixtures={fixtures.length > 0}
            onChange={actions.setSettings}
            onGenerate={requestGenerate}
          />
        </Dialog>
      )}

      {dialog === "auto" && (
        <Dialog title="Auto-schedule" onClose={() => setDialog(null)}>
          <AutoSchedulePanel tournament={base.tournament} pendingCount={unscheduled} onRun={runAutoSchedule} />
        </Dialog>
      )}

      {editing && (
        <FixtureEditor
          key={editing.id}
          fixture={editing}
          allFixtures={fixtures}
          ctx={ctx}
          onSave={saveEdit}
          onClose={() => setEditingId(null)}
        />
      )}

      {confirm?.kind === "publish" && (
        <ConfirmModal
          title="Publish schedule?"
          message="Publishing makes these fixtures visible to everyone on the public tournament page."
          confirmText="Yes, publish"
          confirmClass="btn-primary"
          onConfirm={runPublish}
          onCancel={() => setConfirm(null)}
        >
          <ul className="modal-stats">
            <li>
              Fixtures: <strong>{live.length}</strong>
            </li>
            <li>
              Scheduled: <strong>{live.length - unscheduled}</strong>
            </li>
            {unscheduled > 0 && (
              <li className="modal-warning">
                {unscheduled} fixture{unscheduled === 1 ? " has" : "s have"} no date, time or pitch yet and will show as "To be confirmed".
              </li>
            )}
          </ul>
        </ConfirmModal>
      )}

      {confirm?.kind === "regenerate" && (
        <ConfirmModal
          title="Replace the current fixtures?"
          message={`Generating again deletes all ${fixtures.length} fixtures in the draft, including any dates, pitches and cancellations you set.${
            completed > 0 ? ` ${completed} match${completed === 1 ? "" : "es"} already played will be deleted too, with their results and events.` : ""
          } A published version stays online until you publish again.`}
          confirmText="Yes, regenerate"
          onConfirm={() => {
            setConfirm(null);
            runGenerate();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {cancelTarget && (
        <ConfirmModal
          title="Cancel this fixture?"
          message={`${cancelTarget.roundLabel} · ${cancelTarget.matchLabel} will be marked as cancelled and its pitch and teams become free.`}
          confirmText="Yes, cancel fixture"
          cancelText="Keep fixture"
          onConfirm={runCancel}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
