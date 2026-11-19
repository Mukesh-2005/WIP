// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import MatchCentre from "../components/MatchCentre";
import DemoMatch from "../components/DemoMatch";
import { makeMatch, away, home } from "./helpers";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

async function mount(element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<StrictMode>{element}</StrictMode>);
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

// ---- tiny helpers that behave like a user ----
const text = (selector) => container.querySelector(selector)?.textContent.trim();
const button = (label) =>
  [...container.ownerDocument.querySelectorAll("button")].find((b) => b.textContent.trim() === label);

async function click(label) {
  const b = button(label);
  if (!b) throw new Error(`No button "${label}"`);
  await act(async () => b.click());
}

async function choose(index, value) {
  const el = container.querySelectorAll(".event-form select")[index];
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

// Records an event through the form: type, side, player (and player in for substitutions).
async function addEvent(type, side, playerId, playerInId) {
  await choose(0, type);
  await choose(1, side);
  if (type === "replacement") {
    await choose(2, String(playerInId));
  } else {
    await choose(2, String(playerId));
    if (playerInId) await choose(3, String(playerInId));
  }
  await click("Add event");
}

const score = () => text(".score").replace(/\s+/g, " ");
const eventRows = () => container.querySelectorAll(".timeline li").length;
const typeOptions = () => [...container.querySelectorAll(".event-form select")[0].options].map((o) => o.value);

describe("Match Centre: the full workflow", () => {
  it("start -> events -> undo -> end with confirmation -> summary", async () => {
    await mount(<MatchCentre match={makeMatch()} />);

    expect(score()).toBe("0 - 0");
    expect(text(".status")).toBe("Not started");
    expect(button("Add event").disabled).toBe(true);

    await click("Start match");
    expect(text(".status")).toBe("Live");

    await addEvent("goal", "home", home(1));
    expect(score()).toBe("1 - 0");
    await addEvent("own_goal", "home", home(2));
    expect(score()).toBe("1 - 1");
    await addEvent("yellow_card", "away", away(1));
    await addEvent("red_card", "away", away(2));
    await addEvent("substitution", "home", home(3), home(6));
    expect(eventRows()).toBe(5);
    expect(score()).toBe("1 - 1"); // cards and subs do not change the score

    // every event has a timestamp
    container.querySelectorAll(".timeline .event-time").forEach((el) => {
      expect(el.textContent).toMatch(/^\d\d:\d\d$/);
    });

    await click("Undo last event");
    expect(eventRows()).toBe(4);

    await click("Pause");
    expect(text(".status")).toBe("Paused");
    await click("Resume");
    expect(text(".status")).toBe("Live");

    // confirmation before ending
    await click("End match");
    expect(container.ownerDocument.querySelector(".modal")).not.toBeNull();
    await click("Cancel");
    expect(text(".status")).toBe("Live");

    await click("End match");
    await click("Yes, end match");
    expect(text(".status")).toBe("Full time");
    expect(container.querySelector(".summary")).not.toBeNull();
    expect(button("Add event").disabled).toBe(true);
    expect(button("Undo last event").disabled).toBe(true);
  });

  it("a finished match is saved to history and can be retrieved after a reload", async () => {
    await mount(<DemoMatch />);
    await click("Start match");
    await addEvent("goal", "home", 1); // mock data: John Doe
    await click("End match");
    await click("Yes, end match");

    const history = JSON.parse(localStorage.getItem("turf.match.history"));
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: "ended", score: { home: 1, away: 0 } });

    // simulate a page reload
    await act(async () => root.unmount());
    container.remove();
    await mount(<DemoMatch />);
    await act(async () => {}); // let the async load finish

    expect(text(".status")).toBe("Full time");
    expect(score()).toBe("1 - 0");
    expect(container.querySelector(".history li")?.textContent).toContain("Green Hawks 1 - 0 Blue Sharks");
  });

  it("New match resets the screen and clears the saved in-progress match", async () => {
    await mount(<MatchCentre match={makeMatch()} />);
    await click("Start match");
    await addEvent("goal", "home", home(1));
    await click("End match");
    await click("Yes, end match");
    await click("New match");

    expect(score()).toBe("0 - 0");
    expect(eventRows()).toBe(0);
    expect(text(".time")).toBe("00:00");
    expect(localStorage.getItem("turf.match.current")).toBeNull();
  });
});

describe("Match Centre: restoring a saved match", () => {
  it("a match that was running comes back paused with its score and events", async () => {
    await mount(<DemoMatch />);
    await click("Start match");
    await addEvent("goal", "away", 5);
    await act(async () => root.unmount());
    container.remove();

    await mount(<DemoMatch />);
    await act(async () => {});
    expect(text(".status")).toBe("Paused");
    expect(score()).toBe("0 - 1");
    expect(eventRows()).toBe(1);
  });
});

describe("Match Centre: minimum players rule", () => {
  it("stops the clock, flags the team and blocks Resume; undo fixes it", async () => {
    await mount(<MatchCentre match={makeMatch({ rules: { minPlayersToContinue: 3 } })} />);
    await click("Start match");

    await addEvent("red_card", "away", away(1));
    await addEvent("red_card", "away", away(2));
    expect(container.querySelector(".banner")).toBeNull(); // 3 players: still allowed
    expect(text(".status")).toBe("Live");

    await addEvent("red_card", "away", away(3)); // 2 players: below minimum

    expect(text(".status")).toBe("Paused"); // clock stopped automatically
    expect(container.querySelector(".banner")?.textContent).toContain("Away FC");
    expect(button("Resume").disabled).toBe(true);
    expect(score()).toBe("0 - 0"); // no forfeit applied

    await click("Undo last event");
    expect(container.querySelector(".banner")).toBeNull();
    expect(button("Resume").disabled).toBe(false);
    await click("Resume");
    expect(text(".status")).toBe("Live");
  });

  it("can still end the match while blocked, with no forfeit", async () => {
    await mount(<MatchCentre match={makeMatch()} />);
    await click("Start match");
    await addEvent("red_card", "home", home(1));
    await addEvent("red_card", "home", home(2));
    await addEvent("red_card", "home", home(3));

    await click("End match");
    expect(container.ownerDocument.querySelector(".modal-warning")).not.toBeNull();
    await click("Yes, end match");
    expect(text(".status")).toBe("Full time");
    expect(score()).toBe("0 - 0");
    expect(container.querySelector(".summary .warning")).not.toBeNull();
  });

  it("cannot start with a lineup below the minimum", async () => {
    const match = makeMatch({ rules: { minPlayersToContinue: 3 } });
    match.teams.home.players.forEach((p, i) => (p.bench = i >= 2)); // 2 starters
    await mount(<MatchCentre match={match} />);

    expect(container.querySelector(".banner")?.textContent).toContain("Home FC");
    expect(button("Start match").disabled).toBe(true);
  });

  it("works for a 7-a-side tournament", async () => {
    await mount(
      <MatchCentre match={makeMatch({ playersPerSide: 7, rules: { minPlayersToContinue: 5 } })} />
    );
    expect(text(".rules-line")).toContain("7-a-side");
    await click("Start match");
    await addEvent("red_card", "home", home(1));
    await addEvent("red_card", "home", home(2));
    expect(container.querySelector(".banner")).toBeNull(); // 5 left
    await addEvent("red_card", "home", home(3)); // 4 left
    expect(container.querySelector(".banner")).not.toBeNull();
  });
});

describe("Match Centre: red-card replacement rule", () => {
  it("default rule: no replacement option appears after a red card", async () => {
    await mount(<MatchCentre match={makeMatch()} />);
    await click("Start match");
    await addEvent("red_card", "home", home(1));
    await choose(1, "home");
    expect(typeOptions()).not.toContain("replacement");
    expect(container.querySelector(".event-form .hint")?.textContent).toContain("man short");
  });

  it("'immediate' rule: the team can bring on a replacement, once", async () => {
    await mount(
      <MatchCentre match={makeMatch({ rules: { redCardReplacement: "immediate" } })} />
    );
    await click("Start match");
    expect(typeOptions()).not.toContain("replacement"); // nobody sent off yet

    await addEvent("red_card", "home", home(1));
    await choose(1, "home");
    expect(typeOptions()).toContain("replacement");

    await addEvent("replacement", "home", null, home(6));
    expect(container.querySelector(".timeline li")?.textContent).toContain("comes on");

    await choose(1, "home");
    expect(typeOptions()).not.toContain("replacement"); // slot already filled
  });
});

describe("Match Centre: players on the pitch", () => {
  it("substituted-off and sent-off players disappear from the player list; undo brings them back", async () => {
    await mount(<MatchCentre match={makeMatch()} />);
    await click("Start match");

    await addEvent("substitution", "home", home(1), home(6));
    await addEvent("red_card", "home", home(2));

    await choose(0, "goal");
    await choose(1, "home");
    const playerOptions = () =>
      [...container.querySelectorAll(".event-form select")[2].options].map((o) => o.value);
    expect(playerOptions()).not.toContain(String(home(1)));
    expect(playerOptions()).not.toContain(String(home(2)));
    expect(playerOptions()).toContain(String(home(6)));

    await click("Undo last event");
    await click("Undo last event");
    expect(playerOptions()).toContain(String(home(1)));
    expect(playerOptions()).toContain(String(home(2)));
  });
});
