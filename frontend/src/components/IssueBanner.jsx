// Shown when a rule problem (e.g. a team below the minimum players) blocks the match.
export default function IssueBanner({ issues, status }) {
  if (issues.length === 0) return null;

  const action = status === "idle" ? "start" : "continue";

  return (
    <div className="banner banner-warning" role="alert">
      <strong>The match cannot {action} yet.</strong>
      <ul>
        {issues.map((issue) => (
          <li key={`${issue.code}-${issue.side}`}>{issue.message}</li>
        ))}
      </ul>
      <p>
        Resolve it first (for example, undo a mistaken event), or end the match. Nothing is
        forfeited automatically.
      </p>
    </div>
  );
}
