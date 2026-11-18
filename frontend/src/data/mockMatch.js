import { normalizeRules } from "../config/rules";

// Mock data shaped like a future API response.
// Later: replace this import with a fetch() to the FastAPI backend.
//
// tournament.rules are tournament-level settings (players per side, minimum
// players, red-card replacement). Change them here to try other formats.
// `bench: true` marks substitutes. `logo: null` -> initials badge is shown.
export const mockMatch = {
  id: 1,
  tournament: {
    id: 1,
    name: "Turf Premier Cup",
    sport: "football",
    rules: normalizeRules({
      playersPerSide: 5,
      minPlayersToContinue: 3,
      redCardReplacement: "none",
    }),
  },
  teams: {
    home: {
      id: 101,
      name: "Green Hawks",
      logo: null,
      color: "#0E7A4F",
      players: [
        { id: 1, name: "John Doe", jersey: 9, bench: false },
        { id: 2, name: "Jane Smith", jersey: 7, bench: false },
        { id: 3, name: "Mike Johnson", jersey: 4, bench: false },
        { id: 4, name: "Emily Davis", jersey: 1, bench: false },
        { id: 13, name: "Ryan Cole", jersey: 11, bench: false },
        { id: 9, name: "Aaron Clark", jersey: 14, bench: true },
        { id: 10, name: "Sara Lee", jersey: 17, bench: true },
        { id: 14, name: "Dan Reed", jersey: 21, bench: true },
      ],
    },
    away: {
      id: 102,
      name: "Blue Sharks",
      logo: null,
      color: "#1F5FBF",
      players: [
        { id: 5, name: "Chris Brown", jersey: 10, bench: false },
        { id: 6, name: "Patricia Taylor", jersey: 8, bench: false },
        { id: 7, name: "Robert Wilson", jersey: 5, bench: false },
        { id: 8, name: "Linda Martinez", jersey: 2, bench: false },
        { id: 15, name: "Olivia Grant", jersey: 6, bench: false },
        { id: 11, name: "Tom Hardy", jersey: 15, bench: true },
        { id: 12, name: "Nina Patel", jersey: 20, bench: true },
        { id: 16, name: "Mark Stone", jersey: 22, bench: true },
      ],
    },
  },
};
