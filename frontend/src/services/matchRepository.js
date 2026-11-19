// Storage layer for matches. Everything is async and returns plain match records,
// so replacing the browser storage below with FastAPI calls later changes only
// this file:
//   loadCurrent()   -> GET    /api/v1/matches/{id}
//   saveCurrent(r)  -> PUT    /api/v1/matches/{id}
//   archiveMatch(r) -> PUT    /api/v1/matches/{id}  (status "ended")
//   listHistory()   -> GET    /api/v1/matches?status=ended
//
// A match opened from a fixture is saved under that fixture's id, so every
// fixture keeps its own in-progress match. The standalone demo match (no
// fixture) uses the single "current" slot, exactly as before.

const KEYS = { current: "turf.match.current", history: "turf.match.history" };
const currentKey = (fixtureId) => (fixtureId ? `${KEYS.current}.${fixtureId}` : KEYS.current);

function read(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback; // storage blocked or data corrupted: behave as "nothing saved"
  }
}

function write(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the app keeps working in memory */
  }
}

export const matchRepository = {
  // fixtureId is optional: leave it out for the standalone demo match.
  async loadCurrent(fixtureId = null) {
    return read(currentKey(fixtureId), null);
  },

  async saveCurrent(record) {
    write(currentKey(record.fixtureId), record);
  },

  async clearCurrent(fixtureId = null) {
    try {
      globalThis.localStorage?.removeItem(currentKey(fixtureId));
    } catch {
      /* ignore */
    }
  },

  // Saves a finished match into history (newest first). Saving the same id again replaces it.
  async archiveMatch(record) {
    const others = read(KEYS.history, []).filter((m) => m.id !== record.id);
    write(KEYS.history, [record, ...others]);
  },

  async listHistory() {
    return read(KEYS.history, []);
  },
};
