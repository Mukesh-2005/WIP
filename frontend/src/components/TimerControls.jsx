export default function TimerControls({
  status,
  blocked = false, // true when a rule problem stops the match from starting/continuing
  onStart,
  onPause,
  onResume,
  onEnd,
  onReset,
}) {
  if (status === "ended") {
    return (
      <div className="controls">
        <p className="ended-note">Match ended</p>
        {onReset && (
          <button className="btn btn-primary" onClick={onReset}>
            New match
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="controls">
      {status === "idle" && (
        <button className="btn btn-primary" onClick={onStart} disabled={blocked}>
          Start match
        </button>
      )}
      {status === "running" && (
        <button className="btn btn-amber" onClick={onPause}>
          Pause
        </button>
      )}
      {status === "paused" && (
        <button className="btn btn-primary" onClick={onResume} disabled={blocked}>
          Resume
        </button>
      )}
      {status !== "idle" && (
        <button className="btn btn-danger" onClick={onEnd}>
          End match
        </button>
      )}
    </div>
  );
}
