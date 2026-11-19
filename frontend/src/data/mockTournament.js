import { normalizeRules } from "../config/rules";
import { TEAM_APPROVAL, DEFAULT_SCHEDULE } from "../config/fixtures";

// Mock data shaped like a future API response (tournament + pitches + registered teams).
// Later: replace tournamentRepository.load() with fetch() calls to FastAPI.

export const mockTournament = {
  id: 1,
  name: "Turf Premier Cup",
  sport: "football",
  rules: normalizeRules({ playersPerSide: 5, minPlayersToContinue: 3, redCardReplacement: "none" }),
  startDate: "2026-11-20",
  endDate: "2026-12-20",
  defaults: { ...DEFAULT_SCHEDULE },
};

export const mockPitches = [
  { id: "pitch-a", name: "Pitch A" },
  { id: "pitch-b", name: "Pitch B" },
  { id: "pitch-c", name: "Pitch C" },
];

const FIRST_NAMES = ["Aarav", "Vihaan", "Kabir", "Rohan", "Arjun", "Ishaan", "Dev", "Yash", "Neel", "Ravi", "Sameer", "Tara"];

// 5 starters + 3 substitutes, so a team is ready for the Match Centre.
function makePlayers(teamId, teamIndex) {
  return Array.from({ length: 8 }, (_, i) => ({
    id: teamId * 100 + i + 1,
    name: `${FIRST_NAMES[(teamIndex + i) % FIRST_NAMES.length]} ${String.fromCharCode(65 + teamIndex)}${i + 1}`,
    jersey: i + 1,
    bench: i >= 5,
  }));
}

const TEAM_SEEDS = [
  ["Green Hawks", "#0E7A4F", TEAM_APPROVAL.APPROVED],
  ["Blue Sharks", "#1F5FBF", TEAM_APPROVAL.APPROVED],
  ["Red Falcons", "#C0392B", TEAM_APPROVAL.APPROVED],
  ["Golden Lions", "#B8860B", TEAM_APPROVAL.APPROVED],
  ["Night Owls", "#3D3D6B", TEAM_APPROVAL.APPROVED],
  ["City Titans", "#2C7A7B", TEAM_APPROVAL.APPROVED],
  ["Royal Eagles", "#6B3FA0", TEAM_APPROVAL.APPROVED],
  ["Storm Riders", "#455A64", TEAM_APPROVAL.APPROVED],
  ["Urban Wolves", "#8D6E63", TEAM_APPROVAL.APPROVED],
  ["Silver Foxes", "#78909C", TEAM_APPROVAL.APPROVED],
  ["Iron Bulls", "#5D4037", TEAM_APPROVAL.APPROVED],
  ["Wild Panthers", "#212121", TEAM_APPROVAL.APPROVED],
];

// 9 approved teams (an odd number, so byes are used), 2 awaiting approval, 1 rejected.
export const mockTeams = TEAM_SEEDS.map(([name, color, approvalStatus], index) => {
  const id = 101 + index;
  return { id, name, logo: null, color, approvalStatus, players: makePlayers(id, index) };
});
