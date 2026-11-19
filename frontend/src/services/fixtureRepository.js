// Storage for fixtures. Async and plain-JSON on purpose: swapping browser
// storage for FastAPI later changes only this file.
//
//   loadDraft(tid)          -> GET    /api/v1/tournaments/{tid}/fixtures/draft
//   saveDraft(tid, draft)   -> PUT    /api/v1/tournaments/{tid}/fixtures/draft
//   loadPublished(tid)      -> GET    /api/v1/public/tournaments/{tid}/fixtures   (public page, no login)
//   savePublished(tid, p)   -> POST   /api/v1/tournaments/{tid}/fixtures/publish
//
// The DRAFT is the organiser's working copy. The PUBLISHED copy is a snapshot
// that the public page reads; it only changes when the organiser publishes.

import { readJson, writeJson } from "./storage";

const draftKey = (tid) => `turf.fixtures.draft.${tid}`;
const publishedKey = (tid) => `turf.fixtures.published.${tid}`;

export const fixtureRepository = {
  async loadDraft(tid) {
    return readJson(draftKey(tid), null); // { fixtures, byes, settings, draftSavedAt }
  },
  async saveDraft(tid, draft) {
    writeJson(draftKey(tid), draft);
  },
  async loadPublished(tid) {
    return readJson(publishedKey(tid), null); // { publishedAt, fixtures, byes }
  },
  async savePublished(tid, published) {
    writeJson(publishedKey(tid), published);
  },
};
