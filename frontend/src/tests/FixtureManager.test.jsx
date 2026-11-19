// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import App from "../App";
import { generateFixtures } from "../fixtures/generator";
import { mockTeams } from "../data/mockTournament";

// These tests use their own fixed team statuses (9 approved, 2 pending, 1 rejected),
// so changing the statuses in data/mockTournament.js never breaks them.
vi.mock("../data/mockTournament", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    mockTeams: real.mockTeams.map((t, i) => ({ ...t, approvalStatus: i < 9 ? "approved" : i < 11 ? "pending" : "rejected" })),
  };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
  await settle();
}

// wait for async loading (repositories are async on purpose)
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

async function unmount() {
  await act(async () => root.unmount());
  container.remove();
}

beforeEach(() => localStorage.clear());
afterEach(async () => {
  await unmount();
});

// ---- helpers that behave like a user ----
const doc = () => container.ownerDocument;
const buttons = (scope = doc()) => [...scope.querySelectorAll("button")];
const button = (label, scope = doc()) => buttons(scope).find((b) => b.textContent.trim() === label);
const text = (selector) => container.querySelector(selector)?.textContent.trim();
const stat = (name) => Number(container.querySelector(`[data-testid="stat-${name}"]`).textContent);
const card = (id) => container.querySelector(`[data-testid="fixture-${id}"]`);

async function click(label, scope) {
  const b = button(label, scope);
  if (!b) throw new Error(`No button "${label}"`);
  await act(async () => b.click());
}

async function setValue(el, value) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

// finds a form control by the start of its label text, inside `scope`
function field(label, scope = container) {
  const l = [...scope.querySelectorAll("label")].find((x) => x.textContent.trim().startsWith(label));
  if (!l) throw new Error(`No field "${label}"`);
  return l.querySelector("input,select");
}

async function schedule(id, { date, time, pitch }) {
  await act(async () => button("Edit", card(id)).click());
  const dialog = doc().querySelector("[role=dialog]");
  await setValue(field("Date", dialog), date);
  await setValue(field("Time", dialog), time);
  await setValue(field("Pitch", dialog), pitch);
  return dialog;
}

const saveDialog = (dialog) => click("Save fixture", dialog);
const errorsIn = (dialog) => [...dialog.querySelectorAll(".editor-errors li")].map((li) => li.textContent);

// "Generate fixtures" opens the dialog; "Generate" inside it creates the fixtures.
async function generate() {
  await click("Generate fixtures");
  await click("Generate");
}

async function autoSchedule() {
  await click("Auto-schedule");
  await click("Schedule pending fixtures");
}

describe("Fixture Manager: generating", () => {
  it("starts empty, then generates a league for the 9 approved teams (odd number -> byes)", async () => {
    await mount();
    expect(stat("total")).toBe(0);
    expect(container.textContent).toContain("No fixtures yet");

    await generate();
    expect(stat("total")).toBe(36); // 9 teams: 36 pairs
    expect(stat("pending")).toBe(36);
    expect(container.querySelectorAll(".bye-line").length).toBe(9); // one team rests in each of the 9 rounds
    expect(container.textContent).toContain("Generated 36 fixtures in 9 rounds for 9 approved teams");
    expect(text(".fm-subtitle")).toBe("Turf Premier Cup · Round-robin · 9 teams · 36 matches");
  });

  it("generates a knockout and a league + knockout", async () => {
    await mount();
    await click("Generate fixtures");
    await setValue(field("Format"), "knockout");
    await click("Generate");
    expect(stat("total")).toBe(8); // 9 teams -> 8 matches
    expect(container.textContent).toContain("Knockout · Final");

    await click("Generate fixtures");
    await setValue(field("Format"), "league_knockout");
    await click("Regenerate");
    await click("Yes, regenerate");
    expect(stat("total")).toBe(36 + 7); // 9 teams: 8 qualifiers by default
    expect(container.textContent).toContain("1st in league");
  });

  it("asks before replacing fixtures", async () => {
    await mount();
    await generate();
    await click("Generate fixtures");
    await click("Regenerate");
    expect(doc().querySelector("[role=dialog]").textContent).toContain("Replace the current fixtures?");
    await click("Cancel");
    expect(stat("total")).toBe(36);
  });
});

describe("Fixture Manager: scheduling and conflicts", () => {
  it("schedules a fixture and the dashboard follows", async () => {
    await mount();
    await generate();
    const dialog = await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" });
    expect(errorsIn(dialog)).toEqual([]);
    await saveDialog(dialog);
    expect(doc().querySelector("[role=dialog]")).toBeNull();
    expect(stat("scheduled")).toBe(1);
    expect(stat("pending")).toBe(35);
    expect(card("LG-R1-M1").textContent).toContain("10:00–10:40");
    expect(card("LG-R1-M1").textContent).toContain("Pitch A");
  });

  it("blocks two matches on the same pitch at overlapping times, with a clear message", async () => {
    await mount();
    await generate();
    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" }));

    const dialog = await schedule("LG-R1-M2", { date: "2026-11-20", time: "10:30", pitch: "pitch-a" });
    const errors = errorsIn(dialog);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Pitch A is already booked for .* vs .*10:00–10:40/);
    expect(button("Save fixture", dialog).disabled).toBe(true);

    // choosing another pitch fixes it
    await setValue(field("Pitch", dialog), "pitch-b");
    expect(errorsIn(dialog)).toEqual([]);
    expect(button("Save fixture", dialog).disabled).toBe(false);
  });

  it("blocks a team from playing two matches at the same time (different pitches)", async () => {
    await mount();
    await generate();
    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" }));
    // Urban Wolves also play in round 2, match 1
    const dialog = await schedule("LG-R2-M1", { date: "2026-11-20", time: "10:10", pitch: "pitch-b" });
    expect(errorsIn(dialog).join(" ")).toMatch(/Urban Wolves is already playing/);
    expect(button("Save fixture", dialog).disabled).toBe(true);
  });

  it("rejects a half-filled date and time", async () => {
    await mount();
    await generate();
    const dialog = await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" });
    await setValue(field("Time", dialog), "");
    expect(errorsIn(dialog).join(" ")).toMatch(/both a date and a time/);
    expect(button("Save fixture", dialog).disabled).toBe(true);
  });

  it("does not allow a team to be set against itself, or an unapproved team", async () => {
    await mount();
    await generate();
    await act(async () => button("Edit", card("LG-R1-M1")).click());
    const dialog = doc().querySelector("[role=dialog]");
    const home = field("Home team", dialog);
    await setValue(field("Away team", dialog), home.value);
    expect(errorsIn(dialog).join(" ")).toMatch(/cannot play against itself/);
    const options = [...home.options].map((o) => o.textContent);
    expect(options.join("|")).not.toContain("Wild Panthers"); // rejected team is not offered
    expect(options.join("|")).not.toContain("Silver Foxes"); // pending team is not offered
  });

  it("reschedules a fixture, cancels it and frees the slot", async () => {
    await mount();
    await generate();
    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" }));
    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-21", time: "15:30", pitch: "pitch-b" })); // reschedule
    expect(card("LG-R1-M1").textContent).toContain("15:30–16:10");
    expect(stat("scheduled")).toBe(1);

    await act(async () => button("Cancel fixture", card("LG-R1-M1")).click());
    await click("Yes, cancel fixture");
    expect(stat("cancelled")).toBe(1);
    expect(stat("scheduled")).toBe(0);
    expect(button("Open match", card("LG-R1-M1"))).toBeUndefined();

    // the slot is free now: another match can take it
    await saveDialog(await schedule("LG-R1-M2", { date: "2026-11-21", time: "15:30", pitch: "pitch-b" }));
    expect(stat("scheduled")).toBe(1);
    expect(stat("cancelled")).toBe(1);
  });

  it("auto-schedules every pending fixture without a single conflict", async () => {
    await mount();
    await generate();
    await autoSchedule();
    expect(container.textContent).toContain("Scheduled 36 fixtures with no conflicts");
    expect(stat("scheduled")).toBe(36);
    expect(stat("pending")).toBe(0);
    expect(container.querySelectorAll(".pill-conflict").length).toBe(0);
    expect(container.querySelector('[data-testid="conflict-banner"]')).toBeNull();
    expect(container.querySelectorAll(".slot-conflict").length).toBe(0);
  });
});

describe("Fixture Manager: dashboard and filters", () => {
  it("clicking a status card and using the filters narrows the list", async () => {
    await mount();
    await generate();
    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" }));
    await saveDialog(await schedule("LG-R1-M2", { date: "2026-11-21", time: "10:00", pitch: "pitch-b" }));
    const visible = () => container.querySelectorAll(".fixture").length;
    expect(visible()).toBe(36);

    await act(async () => container.querySelector(".stat-scheduled").click());
    expect(visible()).toBe(2);

    await setValue(field("Pitch"), "pitch-a");
    expect(visible()).toBe(1);
    await click("Clear filters");
    expect(visible()).toBe(36);

    await setValue(field("Round"), "league-2");
    expect(visible()).toBe(4); // 9 teams: 4 matches per round
    await setValue(field("Round"), "");
    await setValue(field("Date"), "2026-11-21");
    expect(visible()).toBe(1);
    await setValue(field("Date"), "");
    await setValue(field("Status"), "completed");
    expect(container.textContent).toContain("No fixtures match these filters");
  });
});

describe("Fixture Manager: draft and publish", () => {
  it("requires confirmation, and only then shows fixtures on the public page", async () => {
    await mount();
    await generate();
    expect(text('[data-testid="publish-state"]')).toBe("Draft schedule");

    // public page: nothing yet
    await click("View public page");
    expect(container.querySelector('[data-testid="not-published"]')).not.toBeNull();
    await click("← Organiser view");

    // cancel the confirmation: still a draft
    await click("Publish schedule");
    expect(doc().querySelector("[role=dialog]").textContent).toContain("Publish schedule?");
    expect(doc().querySelector("[role=dialog]").textContent).toContain("36 fixtures have no date, time or pitch yet");
    await click("Cancel");
    expect(text('[data-testid="publish-state"]')).toBe("Draft schedule");

    // confirm
    await click("Publish schedule");
    await click("Yes, publish");
    expect(text('[data-testid="publish-state"]')).toBe("Published");
    expect(container.textContent).toContain("Fixtures published");

    await click("View public page");
    expect(container.querySelectorAll('[data-testid^="public-"]').length).toBe(36);
    expect(container.textContent).toContain("To be confirmed");
  });

  it("the public page shows the published copy, not later draft changes, until published again", async () => {
    await mount();
    await generate();
    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" }));
    await click("Publish schedule");
    await click("Yes, publish");

    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-22", time: "12:00", pitch: "pitch-c" }));

    await click("View public page");
    expect(container.querySelector('[data-testid="public-LG-R1-M1"]').textContent).toContain("10:00–10:40");
    await click("← Organiser view");

    await click("Publish schedule");
    await click("Yes, publish");
    await click("View public page");
    expect(container.querySelector('[data-testid="public-LG-R1-M1"]').textContent).toContain("12:00–12:40");
  });

  it("cancelled fixtures stay visible on the public page, marked as cancelled", async () => {
    await mount();
    await generate();
    await act(async () => button("Cancel fixture", card("LG-R1-M1")).click());
    await click("Yes, cancel fixture");
    await click("Publish schedule");
    await click("Yes, publish");
    await click("View public page");
    expect(container.querySelector('[data-testid="public-LG-R1-M1"]').textContent).toContain("Cancelled");
  });

  it("saving a draft keeps the fixtures after a reload", async () => {
    await mount();
    await generate();
    expect(container.textContent).toContain("Unsaved changes");
    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" }));
    await click("Save draft");
    expect(container.textContent).toContain("Draft saved");

    await unmount(); // "close the tab"
    await mount(); // "open it again"
    expect(stat("total")).toBe(36);
    expect(stat("scheduled")).toBe(1);
    expect(card("LG-R1-M1").textContent).toContain("10:00–10:40");
  });
});

describe("Fixture Manager -> Match Centre", () => {
  it("only a scheduled fixture with both teams can be opened", async () => {
    await mount();
    await generate();
    const open = () => button("Open match", card("LG-R1-M1"));
    expect(open().disabled).toBe(true);
    expect(open().title).toMatch(/Set the date, time and pitch first/);
    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" }));
    expect(open().disabled).toBe(false);
  });

  it("opens the match with the right teams, tournament and schedule, and sends the result back", async () => {
    await mount();
    await generate();
    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" }));
    await click("Publish schedule");
    await click("Yes, publish");
    const title = card("LG-R1-M1").querySelector(".cell-match").textContent;

    await act(async () => button("Open match", card("LG-R1-M1")).click());
    await settle();

    const names = [...container.querySelectorAll(".scoreboard h2")].map((h) => h.textContent);
    expect(names).toHaveLength(2);
    expect(names.every((n) => title.includes(n))).toBe(true);
    expect(text(".scoreboard .tournament")).toBe("Turf Premier Cup");
    expect(text(".schedule-line")).toBe("League · Round 1 · Match 1 · Fri, 20 Nov 2026 · 10:00–10:40 · Pitch A");
    expect(button("New match")).toBeUndefined(); // fixture matches cannot be reset

    // play: start, one goal for the home side, end
    await click("Start match");
    const select = container.querySelectorAll(".event-form select")[2];
    await setValue(select, [...select.options].find((o) => o.value).value);
    await click("Add event");
    expect(text(".score").replace(/\s+/g, " ")).toBe("1 - 0");
    await click("End match");
    await click("Yes, end match");
    await settle();

    // back in the Fixture Manager the fixture is completed with its score
    await click("← Back to fixtures");
    expect(stat("completed")).toBe(1);
    expect(stat("scheduled")).toBe(0);
    expect(card("LG-R1-M1").querySelector(".vs").textContent).toBe("1 - 0");
    expect(button("Edit", card("LG-R1-M1"))).toBeUndefined(); // locked
    expect(button("View match", card("LG-R1-M1"))).toBeDefined();

    // the public page shows the result too
    await click("View public page");
    expect(container.querySelector('[data-testid="public-LG-R1-M1"] .vs').textContent).toBe("1 - 0");

    // reopening shows the finished match, not a fresh one
    await click("← Organiser view");
    await act(async () => button("View match", card("LG-R1-M1")).click());
    await settle();
    expect(text(".status")).toBe("Full time");
    expect(text(".score").replace(/\s+/g, " ")).toBe("1 - 0");
  });

  it("an in-progress fixture match survives leaving the screen, and each fixture keeps its own", async () => {
    await mount();
    await generate();
    await autoSchedule();

    await act(async () => button("Open match", card("LG-R1-M1")).click());
    await settle();
    await click("Start match");
    await click("Pause");
    await click("← Back to fixtures");

    await act(async () => button("Open match", card("LG-R1-M2")).click());
    await settle();
    expect(text(".status")).toBe("Not started"); // a different fixture is not affected
    await click("← Back to fixtures");

    await act(async () => button("Open match", card("LG-R1-M1")).click());
    await settle();
    expect(text(".status")).toBe("Paused"); // the first one was kept
  });

  it("the standalone demo match still works", async () => {
    await mount();
    await click("Match centre");
    await settle();
    expect(text(".scoreboard .tournament")).toBe("Turf Premier Cup");
    expect(container.querySelector(".schedule-line")).toBeNull();
    await click("Start match");
    expect(text(".status")).toBe("Live");
  });
});

describe("Fixture Manager: design details", () => {
  it("shows a red conflict banner and Conflict badges for a clash that is already in the data, and blocks publishing", async () => {
    // Two matches on Pitch A at the same time, as if they had been saved by another tool.
    const { fixtures } = generateFixtures({ teams: mockTeams, format: "league" });
    const clash = (f, startsAt) => ({ ...f, startsAt, pitchId: "pitch-a", status: "scheduled" });
    localStorage.setItem(
      "turf.fixtures.draft.1",
      JSON.stringify({ fixtures: [clash(fixtures[0], "2026-11-20T10:00"), clash(fixtures[1], "2026-11-20T10:20"), ...fixtures.slice(2)], byes: [], settings: {} })
    );
    await mount();

    const banner = container.querySelector('[data-testid="conflict-banner"]');
    expect(banner.textContent).toContain("2 fixtures have a scheduling problem");
    expect(banner.textContent).toMatch(/Pitch A is already booked/);
    expect(card("LG-R1-M1").querySelector(".pill-conflict").textContent).toBe("Conflict");
    expect(card("LG-R1-M2").className).toContain("row-conflict");
    expect(container.querySelector(".slot-conflict")).not.toBeNull(); // red slot in the pitch schedule

    await click("Publish schedule");
    await click("Yes, publish");
    expect(container.textContent).toContain("Fixtures cannot be published yet");
    expect(text('[data-testid="publish-state"]')).toBe("Draft schedule");

    await click("Resolve"); // opens the editor on the problem fixture
    expect(doc().querySelector("[role=dialog]").textContent).toContain("Pitch A is already booked");
  });

  it("the pitch schedule shows booked slots per pitch and hour, and a Free slot", async () => {
    await mount();
    expect(container.textContent).toContain("Schedule some fixtures to see them");
    await generate();
    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" }));
    await saveDialog(await schedule("LG-R1-M2", { date: "2026-11-20", time: "12:00", pitch: "pitch-b" }));

    const grid = container.querySelector(".timeline-grid");
    expect(container.querySelector(".timeline-head h3").textContent).toBe("Pitch schedule · Fri, 20 Nov");
    expect([...grid.querySelectorAll(".timeline-hour")].map((e) => e.textContent)).toEqual(["10:00 AM", "11:00 AM", "12:00 PM"]);
    expect([...grid.querySelectorAll(".timeline-pitch")].map((e) => e.textContent)).toEqual(["Pitch A", "Pitch B", "Pitch C"]);
    expect(grid.querySelectorAll(".slot-booked")).toHaveLength(2);
    expect(grid.querySelectorAll(".slot-free").length).toBe(9 - 2);
    expect(grid.querySelectorAll(".slot-conflict")).toHaveLength(0);
  });

  it("the sidebar from the design: only Fixtures and Match centre are built", async () => {
    await mount();
    const items = [...container.querySelectorAll(".sidebar .nav-item")];
    expect(items.map((b) => b.textContent)).toEqual([
      "Dashboard",
      "Tournaments",
      "Teams and registrations",
      "Fixtures",
      "Match centre",
      "Venues",
      "Announcements",
      "Reports",
      "Audit log",
      "View public page",
    ]);
    expect(items.filter((b) => b.disabled).map((b) => b.textContent)).toEqual([
      "Dashboard",
      "Tournaments",
      "Teams and registrations",
      "Venues",
      "Announcements",
      "Reports",
      "Audit log",
    ]);
    expect(container.querySelector(".nav-active").textContent).toBe("Fixtures");
  });

  it("the table has the columns from the design", async () => {
    await mount();
    await generate();
    const headings = [...container.querySelectorAll(".fixtures-table th")].map((th) => th.textContent);
    expect(headings).toEqual(["Match", "Round", "Date and time", "Pitch", "Status", "Actions"]);
    expect(container.querySelector(".filters-count").textContent).toBe("Showing 36 of 36 fixtures");
  });
});

describe("Fixture Manager: starting again after matches were played", () => {
  it("regenerating after a played match works, and the new fixtures start fresh (no old match comes back)", async () => {
    await mount();
    await generate();
    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" }));

    // play one match to the end with a goal
    await act(async () => button("Open match", card("LG-R1-M1")).click());
    await settle();
    await click("Start match");
    const select = container.querySelectorAll(".event-form select")[2];
    await setValue(select, [...select.options].find((o) => o.value).value);
    await click("Add event");
    await click("End match");
    await click("Yes, end match");
    await settle();
    await click("← Back to fixtures");
    expect(stat("completed")).toBe(1);

    // regenerate: allowed, and the dialog says the played match will be deleted
    await click("Generate fixtures");
    await click("Regenerate");
    expect(doc().querySelector("[role=dialog]").textContent).toContain("1 match already played will be deleted too");
    await click("Yes, regenerate");
    expect(stat("completed")).toBe(0);
    expect(stat("total")).toBe(36);
    expect(stat("pending")).toBe(36);

    // the new LG-R1-M1 has the same id as the old one, but it is a brand-new match
    await saveDialog(await schedule("LG-R1-M1", { date: "2026-11-20", time: "10:00", pitch: "pitch-a" }));
    await act(async () => button("Open match", card("LG-R1-M1")).click());
    await settle();
    expect(text(".status")).toBe("Not started");
    expect(text(".score").replace(/\s+/g, " ")).toBe("0 - 0");
  });
});
