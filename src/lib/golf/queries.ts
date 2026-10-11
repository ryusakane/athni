import { cache } from "react";
import { loadDataset } from "./load";
import * as views from "./views";

// Build-time views over the whole dataset (list pages). Detail pages load their rows in the
// browser instead (browse.ts), so the static export does not need a file per player.

export type { PlayerSummary, TournamentSummary } from "./views";

const indexes = cache(async () => views.indexDataset(await loadDataset()));

export const listPlayers = cache(async () => views.listPlayers(await indexes()));

export const listTournaments = cache(async () => views.listTournaments(await indexes()));
