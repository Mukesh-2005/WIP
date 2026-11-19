import { useEffect, useReducer, useState } from "react";
import { mockMatch } from "../data/mockMatch";
import { useMatchTimer, formatTime } from "../hooks/useMatchTimer";
import {
  matchReducer,
  createState,
  activeEvents,
  calculateScore,
  summarizeEvents,
} from "../state/matchReducer";
import { getMatchIssues } from "../state/matchRules";
import { buildMatchRecord, restoreStatus } from "../state/matchRecord";
import { matchRepository } from "../services/matchRepository";
import { describeRules, validateRules } from "../config/rules";
import { newId } from "../utils/id";
import { scheduleLine } from "../fixtures/matchFromFixture";
import ScoreBoard from "./ScoreBoard";
import TimerControls from "./TimerControls";
import EventForm from "./EventForm";
import Timeline from "./Timeline";
import ConfirmModal from "./ConfirmModal";
import FullTimeSummary from "./FullTimeSummary";
import IssueBanner from "./IssueBanner";
import MatchHistory from "./MatchHistory";

// `match` comes from the API later (teams + tournament rules).
// `initialRecord` is a saved match to restore, or null for a fresh one.
// When opened from a fixture, `match` also carries `fixtureId` and `schedule`,
// and `onMatchEnded({ fixtureId, score })` tells the Fixture Manager the result.
export default function MatchCentre({ match = mockMatch, initialRecord = null, onMatchEnded = null }) {
  const { teams, tournament } = match;
  const { rules, sport: sportId } = tournament;

  const [matchId, setMatchId] = useState(() => initialRecord?.id ?? match.fixtureId ?? newId());
  const [startedAt, setStartedAt] = useState(initialRecord?.startedAt ?? null);
  const [endedAt, setEndedAt] = useState(initialRecord?.endedAt ?? null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [history, setHistory] = useState([]);

  const timer = useMatchTimer({
    seconds: initialRecord?.clockSeconds ?? 0,
    status: restoreStatus(initialRecord?.status ?? "idle"),
  });
  const [state, dispatch] = useReducer(matchReducer, initialRecord, createState);

  // ---- everything below is DERIVED from events + rules, never stored ----
  const events = activeEvents(state.events); // what the organiser sees
  const score = calculateScore(state.events, sportId);
  const issues = getMatchIssues(teams, state.events, rules, sportId);
  const blocked = issues.length > 0;
  const ruleErrors = validateRules(rules);
  const stats = summarizeEvents(state.events, sportId);

  // A rule problem while the clock is running stops the clock.
  const { status: timerStatus, pause: pauseTimer } = timer;
  useEffect(() => {
    if (timerStatus === "running" && blocked) pauseTimer();
  }, [timerStatus, pauseTimer, blocked]);

  // Save the in-progress match so a refresh does not lose it (and to show how
  // the data will be persisted).
  useEffect(() => {
    if (timer.status === "idle" && state.events.length === 0) return;
    matchRepository.saveCurrent(
      buildMatchRecord({
        matchId,
        match,
        status: timer.status,
        clockSeconds: timer.seconds,
        startedAt,
        endedAt,
        events: state.events,
      })
    );
  }, [matchId, match, timer.status, timer.seconds, startedAt, endedAt, state.events]);

  // Load match history once.
  useEffect(() => {
    matchRepository.listHistory().then(setHistory);
  }, []);

  // ---- handlers ----
  function handleStart() {
    if (blocked) return;
    setStartedAt((prev) => prev ?? new Date().toISOString());
    timer.start();
  }

  function handleResume() {
    if (blocked) return;
    timer.resume();
  }

  function handleAddEvent(data) {
    dispatch({
      type: "ADD_EVENT",
      event: {
        id: newId(),
        matchId,
        sequence: state.events.length + 1,
        second: timer.seconds,
        createdAt: new Date().toISOString(),
        voidedAt: null,
        ...data,
      },
    });
  }

  async function handleConfirmEnd() {
    const now = new Date().toISOString();
    setEndedAt(now);
    timer.end();
    setConfirmingEnd(false);
    await matchRepository.archiveMatch(
      buildMatchRecord({
        matchId,
        match,
        status: "ended",
        clockSeconds: timer.seconds,
        startedAt,
        endedAt: now,
        events: state.events,
      })
    );
    setHistory(await matchRepository.listHistory());
    onMatchEnded?.({ fixtureId: match.fixtureId ?? null, score });
  }

  function handleReset() {
    timer.reset();
    dispatch({ type: "RESET" });
    setMatchId(newId());
    setStartedAt(null);
    setEndedAt(null);
    matchRepository.clearCurrent(match.fixtureId ?? null);
  }

  const formDisabled = timer.status === "idle" || timer.status === "ended";
  const canUndo = events.length > 0 && timer.status !== "ended";

  if (ruleErrors.length > 0) {
    return (
      <main className="app">
        <div className="banner banner-warning" role="alert">
          <strong>Tournament rules are invalid:</strong>
          <ul>
            {ruleErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <ScoreBoard
        tournament={tournament.name}
        scheduleText={scheduleLine(match.schedule)}
        rulesText={describeRules(rules)}
        home={teams.home}
        away={teams.away}
        score={score}
        time={formatTime(timer.seconds)}
        status={timer.status}
      />

      <TimerControls
        status={timer.status}
        blocked={blocked}
        onStart={handleStart}
        onPause={timer.pause}
        onResume={handleResume}
        onEnd={() => setConfirmingEnd(true)}
        onReset={match.fixtureId ? undefined : handleReset}
      />

      {timer.status !== "ended" && <IssueBanner issues={issues} status={timer.status} />}

      {timer.status === "ended" && (
        <FullTimeSummary
          teams={teams}
          sportId={sportId}
          score={score}
          seconds={timer.seconds}
          events={state.events}
          issues={issues}
        />
      )}

      <div className="layout">
        <EventForm
          teams={teams}
          events={state.events}
          sportId={sportId}
          rules={rules}
          disabled={formDisabled}
          onAddEvent={handleAddEvent}
        />
        <Timeline
          events={events}
          teams={teams}
          sportId={sportId}
          onUndo={() => dispatch({ type: "UNDO_LAST", at: new Date().toISOString() })}
          canUndo={canUndo}
        />
      </div>

      <MatchHistory matches={history} />

      {confirmingEnd && (
        <ConfirmModal
          title="End match?"
          message={`Final score is ${teams.home.name} ${score.home} - ${score.away} ${teams.away.name}. You won't be able to record more events.`}
          confirmText="Yes, end match"
          onConfirm={handleConfirmEnd}
          onCancel={() => setConfirmingEnd(false)}
        >
          <ul className="modal-stats">
            <li>
              Time played: <strong>{formatTime(timer.seconds)}</strong>
            </li>
            <li>
              Events recorded: <strong>{events.length}</strong>
            </li>
            <li>
              Cards: <strong>{stats.home.yellow + stats.home.red + stats.away.yellow + stats.away.red}</strong>{" "}
              · Substitutions: <strong>{stats.home.subs + stats.away.subs}</strong>
            </li>
            {blocked && (
              <li className="modal-warning">
                A team is below the minimum number of players. No forfeit is applied automatically.
              </li>
            )}
          </ul>
        </ConfirmModal>
      )}
    </main>
  );
}
