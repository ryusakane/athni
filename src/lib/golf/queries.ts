import { cache } from "react";
import { loadDataset } from "./load";
import { buildIndexes, playerSummaries, tournamentSummaries } from "./views";

// Build-time reads for the static list pages and the sitemap. Player and tournament detail pages
// are rendered on request by the Worker (worker/index.tsx) from the same views.

const indexes = cache(async () => buildIndexes(await loadDataset()));

export const listPlayers = cache(async () => playerSummaries(await indexes()));

export const listTournaments = cache(async () => tournamentSummaries(await indexes()));

export async function playerIds() {
  return (await indexes()).data.players.map((p) => p.id);
}

export async function tournamentIds() {
  return (await indexes()).data.tournaments.map((t) => t.id);
}
