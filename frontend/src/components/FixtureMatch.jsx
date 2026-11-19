import { useEffect, useMemo, useState } from "react";
import MatchCentre from "./MatchCentre";
import { matchRepository } from "../services/matchRepository";
import { buildMatchFromFixture } from "../fixtures/matchFromFixture";

// Opens ONE fixture in the Match Centre, with that fixture's teams, tournament
// and schedule. When the match ends, the result goes back to the fixture.
export default function FixtureMatch({ fixtureId, store, onBack }) {
  const { base, state, actions } = store;
  const fixture = state.fixtures.find((f) => f.id === fixtureId);
  const [record, setRecord] = useState(undefined); // undefined = loading, null = nothing saved

  useEffect(() => {
    let alive = true;
    matchRepository.loadCurrent(fixtureId).then((r) => alive && setRecord(r));
    return () => {
      alive = false;
    };
  }, [fixtureId]);

  const built = useMemo(
    () => (fixture ? buildMatchFromFixture(fixture, base) : { ok: false, reason: "This fixture no longer exists." }),
    [fixture, base]
  );

  return (
    <div>
      <div className="match-bar">
        <button className="btn btn-ghost" onClick={onBack}>
          ← Back to fixtures
        </button>
      </div>
      {!built.ok ? (
        <p className="banner banner-warning" role="alert">
          This match cannot be opened: {built.reason}
        </p>
      ) : record === undefined ? (
        <p className="hint loading">Loading…</p>
      ) : (
        <MatchCentre
          key={fixtureId}
          match={built.match}
          initialRecord={record}
          onMatchEnded={({ fixtureId: id, score }) => actions.completeMatch(id, score)}
        />
      )}
    </div>
  );
}
