import { useState } from "react";

// Shows the team's logo image. If there is no logo (or it fails to load),
// shows a coloured badge with the team's initials instead.
export default function TeamLogo({ team }) {
  const [failed, setFailed] = useState(false);

  if (team.logo && !failed) {
    return (
      <img
        className="logo"
        src={team.logo}
        alt={`${team.name} logo`}
        onError={() => setFailed(true)}
      />
    );
  }

  const initials = team.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2);

  return (
    <span className="logo logo-fallback" style={{ background: team.color }} aria-hidden="true">
      {initials}
    </span>
  );
}
