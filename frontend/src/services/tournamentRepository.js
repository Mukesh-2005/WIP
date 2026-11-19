// Tournament, pitches and registered teams (mock data for now).
//   load()   -> GET /api/v1/tournaments/{id}  (+ /pitches, /teams)
// Team approval belongs to the team-registration module; here each mock team
// simply has an approvalStatus ("approved", "pending" or "rejected").

import { mockTournament, mockPitches, mockTeams } from "../data/mockTournament";

export const tournamentRepository = {
  async load() {
    return { tournament: mockTournament, pitches: mockPitches, teams: mockTeams };
  },
};
