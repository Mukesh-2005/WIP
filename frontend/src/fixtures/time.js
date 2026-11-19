// Date/time helpers for fixtures.
//
// A fixture time is stored as a plain local string "YYYY-MM-DDTHH:mm" (the
// organiser's own clock, no timezone). To compare times we convert it to
// "minutes since 1970" with pure arithmetic, so results never depend on the
// computer's timezone or daylight-saving changes.

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const pad = (n) => String(n).padStart(2, "0");

// "2026-11-20T10:00" -> minutes, or null when the text is not a real date/time.
export function toMinutes(startsAt) {
  const m = PATTERN.exec(startsAt ?? "");
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const minutes = Date.UTC(y, mo - 1, d, h, mi) / 60000;
  return fromMinutes(minutes) === startsAt ? minutes : null; // rejects 2026-02-31, 25:00 ...
}

export function fromMinutes(minutes) {
  const d = new Date(minutes * 60000);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
}

export const datePart = (startsAt) => (startsAt ? startsAt.slice(0, 10) : "");
export const timePart = (startsAt) => (startsAt ? startsAt.slice(11, 16) : "");
export const composeStartsAt = (date, time) => (date && time ? `${date}T${time}` : null);

export function addDays(date, days) {
  return fromMinutes(toMinutes(`${date}T00:00`) + days * 1440).slice(0, 10);
}

export function formatDate(startsAt) {
  const minutes = toMinutes(startsAt);
  if (minutes === null) return "";
  return new Date(minutes * 60000).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// "10:00-10:40"
export function formatTimeRange(startsAt, durationMinutes) {
  const start = toMinutes(startsAt);
  if (start === null) return "";
  return `${timePart(startsAt)}–${timePart(fromMinutes(start + durationMinutes))}`;
}

export const timeToMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
