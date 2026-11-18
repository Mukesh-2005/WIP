import { useEffect, useState } from "react";
import MatchCentre from "./components/MatchCentre";
import { matchRepository } from "./services/matchRepository";

// Loads a saved in-progress match (if any), then shows the Match Centre.
// Loading is async on purpose: the FastAPI version will be async too.
export default function App() {
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
