import { useState } from "react";
import { getSport } from "../config/sports";
import { getSquad } from "../state/matchReducer";
import { canReplaceNow } from "../state/matchRules";
import { RED_CARD_REPLACEMENT } from "../config/rules";

const playerLabel = (p) => `#${p.jersey} ${p.name}`;

export default function EventForm({ teams, events, sportId, rules, disabled, onAddEvent }) {
  const eventTypes = getSport(sportId).eventTypes;

  const [typeChoice, setTypeChoice] = useState("goal");
  const [side, setSide] = useState("home");
  const [playerId, setPlayerId] = useState("");
  const [playerInId, setPlayerInId] = useState("");

  // Everything below is derived from the events and the tournament rules.
  const squad = getSquad(teams, side, events, sportId);
  const replacementAllowed = canReplaceNow(squad, rules);

  // "Replacement" only appears when the rules allow it for the selected team.
  const availableTypes = Object.entries(eventTypes).filter(
    ([, def]) => def.kind !== "replacement" || replacementAllowed
  );
  const type = availableTypes.some(([key]) => key === typeChoice) ? typeChoice : "goal";
  const kind = eventTypes[type].kind;

  const needsOut = kind === "player" || kind === "substitution";
  const needsIn = kind === "substitution" || kind === "replacement";
  const outOptions = squad.onPitch; // only players currently on the pitch
  const inOptions = squad.bench; // only substitutes who have not come on yet

  // Guard against a stale selection (e.g. after "Undo" changed the squad).
  const outValid = !needsOut || outOptions.some((p) => String(p.id) === playerId);
  const inValid = !needsIn || inOptions.some((p) => String(p.id) === playerInId);
  const canSubmit = outValid && inValid;

  function clearPlayers() {
    setPlayerId("");
    setPlayerInId("");
  }

  function handleSubmit(e) {
    e.preventDefault(); // stop the browser from reloading the page
    if (!canSubmit) return;
    onAddEvent({
      type,
      side,
      playerId: needsOut ? Number(playerId) : null, // <select> values are strings
      playerInId: needsIn ? Number(playerInId) : null,
    });
    clearPlayers();
  }

  return (
    <form className="card event-form" onSubmit={handleSubmit}>
      <h3>Record event</h3>

      <label>
        Event type
        <select
          value={type}
          onChange={(e) => {
            setTypeChoice(e.target.value);
            clearPlayers();
          }}
          disabled={disabled}
        >
          {availableTypes.map(([key, def]) => (
            <option key={key} value={key}>
              {def.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        {type === "own_goal" ? "Team of the player" : "Team"}
        <select
          value={side}
          onChange={(e) => {
            setSide(e.target.value);
            clearPlayers();
          }}
          disabled={disabled}
        >
          <option value="home">{teams.home.name}</option>
          <option value="away">{teams.away.name}</option>
        </select>
      </label>

      {needsOut && (
        <label>
          {kind === "substitution" ? "Player out" : "Player"}
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} disabled={disabled}>
            <option value="">Select player</option>
            {outOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {playerLabel(p)}
              </option>
            ))}
          </select>
        </label>
      )}

      {needsIn && (
        <label>
          {kind === "replacement" ? "Player coming on" : "Player in"}
          <select
            value={playerInId}
            onChange={(e) => setPlayerInId(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select substitute</option>
            {inOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {playerLabel(p)}
              </option>
            ))}
          </select>
        </label>
      )}

      <button className="btn btn-primary" type="submit" disabled={disabled || !canSubmit}>
        Add event
      </button>

      {needsIn && inOptions.length === 0 && (
        <p className="hint">No substitutes left for this team.</p>
      )}
      {squad.pendingReplacements > 0 &&
        rules.redCardReplacement === RED_CARD_REPLACEMENT.NONE && (
          <p className="hint">
            {teams[side].name} played a man short: the tournament rules do not allow a replacement
            after a red card.
          </p>
        )}
      {disabled && (
        <p className="hint">Events can only be recorded while a match is in progress.</p>
      )}
    </form>
  );
}
