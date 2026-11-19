import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { fixtureReducer, initialFixtureState } from "../state/fixtureReducer";
import { generateFixtures, FixtureGenerationError } from "../fixtures/generator";
import { updateFixture, cancelFixture, autoSchedule } from "../fixtures/scheduling";
import { validateAllFixtures } from "../fixtures/validation";
import { fixtureRepository } from "../services/fixtureRepository";
import { tournamentRepository } from "../services/tournamentRepository";
import { matchRepository } from "../services/matchRepository";
import { FIXTURE_STATUS } from "../config/fixtures";

// One place that owns all fixture data. It lives in App, so the Fixture
// Manager, the public page and the Match Centre all see the same fixtures.
export function useFixtureStore() {
  const [base, setBase] = useState(null); // { tournament, pitches, teams }
  const [state, dispatch] = useReducer(fixtureReducer, initialFixtureState);
  const tournamentId = base?.tournament.id;

  useEffect(() => {
    let alive = true;
    (async () => {
      const loaded = await tournamentRepository.load();
      const [draft, published] = await Promise.all([
        fixtureRepository.loadDraft(loaded.tournament.id),
        fixtureRepository.loadPublished(loaded.tournament.id),
      ]);
      if (!alive) return;
      setBase(loaded);
      dispatch({ type: "LOADED", draft, published });
    })();
    return () => {
      alive = false;
    };
  }, []);

  // What the validation functions need to know.
  const ctx = useMemo(
    () => ({ teams: base?.teams ?? [], pitches: base?.pitches ?? [], tournament: base?.tournament }),
    [base]
  );

  // Runs the reducer ourselves first, so we know the NEW state to save.
  const apply = useCallback(
    (action) => {
      dispatch(action);
      return fixtureReducer(state, action);
    },
    [state]
  );

  const persistDraft = useCallback(
    (next, at) =>
      fixtureRepository.saveDraft(tournamentId, {
        fixtures: next.fixtures,
        byes: next.byes,
        settings: next.settings,
        draftSavedAt: at,
      }),
    [tournamentId]
  );

  const actions = {
    setSettings(settings) {
      dispatch({ type: "SETTINGS_CHANGED", settings });
    },

    // -> { ok, error?, summary? }
    generate(settings) {
      try {
        const result = generateFixtures({
          teams: ctx.teams,
          ...settings,
        });
        // New fixtures reuse the same ids (LG-R1-M1 ...), so the saved matches of the
        // old fixtures must be removed, or they would reappear inside the new ones.
        state.fixtures.forEach((f) => matchRepository.clearCurrent(f.id));
        apply({ type: "GENERATED", fixtures: result.fixtures, byes: result.byes, settings });
        return { ok: true, summary: result.summary };
      } catch (err) {
        if (err instanceof FixtureGenerationError) return { ok: false, error: err.message };
        throw err;
      }
    },

    // Each of these returns { ok, errors } so the screen can show the messages.
    updateFixture(id, changes) {
      const result = updateFixture(state.fixtures, id, changes, ctx);
      if (result.ok) apply({ type: "FIXTURES_CHANGED", fixtures: result.fixtures });
      return result;
    },
    cancelFixture(id) {
      const result = cancelFixture(state.fixtures, id);
      if (result.ok) apply({ type: "FIXTURES_CHANGED", fixtures: result.fixtures });
      return result;
    },
    autoSchedule(options) {
      const result = autoSchedule(state.fixtures, options, ctx);
      apply({ type: "FIXTURES_CHANGED", fixtures: result.fixtures });
      return result;
    },

    async saveDraft() {
      const at = new Date().toISOString();
      const next = apply({ type: "DRAFT_SAVED", at });
      await persistDraft(next, at);
      return at;
    },

    // Publishing is blocked while any fixture still has a clash. -> { ok, errors? }
    async publish() {
      const live = state.fixtures.filter((f) => f.status !== FIXTURE_STATUS.CANCELLED);
      if (live.length === 0) {
        return { ok: false, errors: [{ code: "NOTHING_TO_PUBLISH", message: "There are no fixtures to publish. Generate fixtures first." }] };
      }
      const problems = validateAllFixtures(state.fixtures, ctx);
      if (problems.length) return { ok: false, errors: problems };

      const at = new Date().toISOString();
      const next = apply({ type: "PUBLISHED", at });
      await persistDraft(next, at);
      await fixtureRepository.savePublished(tournamentId, next.published);
      return { ok: true, at };
    },

    // Called by the Match Centre when a fixture's match ends. Results are saved straight away.
    async completeMatch(fixtureId, result) {
      const next = apply({ type: "MATCH_COMPLETED", fixtureId, result });
      await persistDraft(next, next.draftSavedAt);
      if (next.published) await fixtureRepository.savePublished(tournamentId, next.published);
    },
  };

  return { loading: base === null, base, state, ctx, actions };
}
