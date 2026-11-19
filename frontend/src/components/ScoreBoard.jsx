import TeamLogo from "./TeamLogo";

const STATUS_LABELS = {
  idle: "Not started",
  running: "Live",
  paused: "Paused",
  ended: "Full time",
};

export default function ScoreBoard({ tournament, scheduleText, rulesText, home, away, score, time, status }) {
  return (
    <section className="scoreboard" aria-label="Scoreboard">
      <p className="tournament">{tournament}</p>
      {scheduleText && <p className="rules-line schedule-line">{scheduleText}</p>}
      {rulesText && <p className="rules-line">{rulesText}</p>}

      <div className="scoreboard-row">
        <div className="team">
          <TeamLogo team={home} />
          <h2>{home.name}</h2>
        </div>

        <div className="center">
          <div className="score" aria-live="polite">
            {score.home} <span className="dash">-</span> {score.away}
          </div>
          <div className="time">{time}</div>
          <span className={`status status-${status}`}>{STATUS_LABELS[status]}</span>
        </div>

        <div className="team">
          <TeamLogo team={away} />
          <h2>{away.name}</h2>
        </div>
      </div>
    </section>
  );
}
