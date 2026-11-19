// Fixture state: (state, action) -> new state. No validation happens here;
// the scheduling functions validate first and only then is a change dispatched.
//
//   fixtures      the organiser's working copy (the draft)
//   byes          which team rests (or advances) in which round
//   settings      generator settings (format, duration ...)
//   published     null, or the snapshot the public page shows: { publishedAt, fixtures, byes }
//   draftSavedAt  when "Save draft" was last pressed
//   dirty         true when the working copy has changes that are not saved yet

import { DEFAULT_SETTINGS } from "../config/fixtures";
import { completeFixture } from "../fixtures/scheduling";

export const initialFixtureState = {
  fixtures: [],
  byes: [],
  settings: DEFAULT_SETTINGS,
  published: null,
  draftSavedAt: null,
  dirty: false,
};

export function fixtureReducer(state, action) {
  switch (action.type) {
    case "LOADED": {
      const { draft, published } = action;
      return {
        ...initialFixtureState,
        fixtures: draft?.fixtures ?? [],
        byes: draft?.byes ?? [],
        settings: { ...DEFAULT_SETTINGS, ...(draft?.settings ?? {}) },
        draftSavedAt: draft?.draftSavedAt ?? null,
        published: published ?? null,
      };
    }
    case "GENERATED":
      return { ...state, fixtures: action.fixtures, byes: action.byes, settings: action.settings, dirty: true };
    case "SETTINGS_CHANGED":
      return { ...state, settings: action.settings, dirty: true };
    case "FIXTURES_CHANGED":
      return { ...state, fixtures: action.fixtures, dirty: true };
    case "DRAFT_SAVED":
      return { ...state, draftSavedAt: action.at, dirty: false };
    case "PUBLISHED":
      return {
        ...state,
        published: { publishedAt: action.at, fixtures: state.fixtures, byes: state.byes },
        draftSavedAt: action.at,
        dirty: false,
      };
    case "MATCH_COMPLETED": {
      // A result is a fact, not a draft edit: it is applied to the public copy too.
      const apply = (list) => completeFixture(list, action.fixtureId, action.result);
      return {
        ...state,
        fixtures: apply(state.fixtures),
        published: state.published ? { ...state.published, fixtures: apply(state.published.fixtures) } : null,
      };
    }
    default:
      return state;
  }
}
