import { useEffect, useState } from "react";
import MatchCentre from "./MatchCentre";
import { matchRepository } from "../services/matchRepository";

// The standalone demo match (mock teams, no fixture). Loads a saved in-progress
// match if there is one. Loading is async on purpose: the FastAPI version will be too.
export default function DemoMatch() {
  const [record, setRecord] = useState(undefined); // undefined = loading, null = nothing saved

  useEffect(() => {
    let alive = true;
    matchRepository.loadCurrent().then((r) => {
      if (alive) setRecord(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (record === undefined) return <p className="hint loading">Loading…</p>;
  return <MatchCentre initialRecord={record} />;
}
