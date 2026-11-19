import { useState } from "react";
import { useFixtureStore } from "./hooks/useFixtureStore";
import AppShell from "./components/AppShell";
import FixtureManager from "./components/fixtures/FixtureManager";
import PublicTournamentPage from "./components/fixtures/PublicTournamentPage";
import FixtureMatch from "./components/FixtureMatch";
import DemoMatch from "./components/DemoMatch";

// App owns the fixture data (so every screen sees the same fixtures) and
// decides which screen to show. A tiny state switch is enough for now; a
// router can replace it when more pages exist.
//   fixtures = organiser's Fixture Manager     public = what the public sees
//   match    = one fixture in the Match Centre  demo   = standalone demo match
export default function App({ initialView = "fixtures" }) {
  const store = useFixtureStore();
  const [view, setView] = useState({ name: initialView, fixtureId: null });
  const go = (name, fixtureId = null) => setView({ name, fixtureId });

  // The public site has its own header; everything else sits inside the organiser layout.
  if (view.name === "public") {
    return store.loading ? (
      <p className="hint loading">Loading…</p>
    ) : (
      <PublicTournamentPage
        tournament={store.base.tournament}
        published={store.state.published}
        teams={store.base.teams}
        pitches={store.base.pitches}
        onBack={() => go("fixtures")}
      />
    );
  }

  return (
    <AppShell activeView={view.name === "match" ? "fixtures" : view.name} onNavigate={go}>
      {view.name === "demo" && <DemoMatch />}
      {view.name !== "demo" && store.loading && <p className="hint loading">Loading…</p>}
      {!store.loading && view.name === "fixtures" && <FixtureManager store={store} onOpenMatch={(id) => go("match", id)} />}
      {!store.loading && view.name === "match" && (
        <FixtureMatch fixtureId={view.fixtureId} store={store} onBack={() => go("fixtures")} />
      )}
    </AppShell>
  );
}
