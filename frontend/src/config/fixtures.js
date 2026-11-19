// Fixture-manager constants. Nothing about formats, statuses or defaults is
// hardcoded in the logic files; they all read from here.

export const FIXTURE_FORMATS = {
  LEAGUE: "league", // everyone plays everyone (round robin)
  KNOCKOUT: "knockout", // lose and you are out
  LEAGUE_KNOCKOUT: "league_knockout", // round robin first, then the top teams go into a knockout
};

export const FORMAT_LABELS = {
  [FIXTURE_FORMATS.LEAGUE]: "League (round robin)",
  [FIXTURE_FORMATS.KNOCKOUT]: "Knockout",
  [FIXTURE_FORMATS.LEAGUE_KNOCKOUT]: "League + Knockout",
};

export const FIXTURE_STATUS = {
  PENDING: "pending", // generated, but date / time / pitch not all set yet
  SCHEDULED: "scheduled", // date, time and pitch are set
  COMPLETED: "completed", // the match was played and ended in the Match Centre
  CANCELLED: "cancelled",
};

export const STATUS_LABELS = {
  pending: "Pending",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Team registration status. Fixtures may only use "approved" teams.
export const TEAM_APPROVAL = {
  APPROVED: "approved",
  PENDING: "pending",
  REJECTED: "rejected",
};

// Placeholder defaults (assumption, to be confirmed): 40 minute match + 10 minute break.
export const DEFAULT_SCHEDULE = { durationMinutes: 40, breakMinutes: 10 };

export const LIMITS = { maxDurationMinutes: 240, maxBreakMinutes: 120 };

export const DEFAULT_SETTINGS = {
  format: FIXTURE_FORMATS.LEAGUE,
  qualifiers: null, // league + knockout: how many teams go through (null = automatic)
  ...DEFAULT_SCHEDULE,
};
