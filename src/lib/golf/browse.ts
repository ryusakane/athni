"use client";

import type { Dataset } from "./types";
import { normalizeNumbers } from "./views";

// Player and tournament pages load only their own rows in the browser, so the static export
// stays one page per route however many players there are (Cloudflare's free plan caps files).
// Reads go to the public Supabase REST API; without Supabase env vars (local dev) the bundled
// seed is used instead.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const empty = (): Dataset => ({
  schools: [],
  players: [],
  courses: [],
  course_tees: [],
  tournaments: [],
  tournament_results: [],
  rounds: [],
  player_rankings: [],
});

// PostgREST `in` filters go in the URL, so long id lists are split.
const CHUNK = 80;

async function rest<T>(table: keyof Dataset, filter: string): Promise<T[]> {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&${filter}`, {
    headers: { apikey: key!, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase ${table}: ${res.status}`);
  return res.json();
}

async function byIds<T>(table: keyof Dataset, column: string, ids: Iterable<string | null>) {
  const unique = [...new Set([...ids].filter((id): id is string => id != null))];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK) chunks.push(unique.slice(i, i + CHUNK));
  const pages = await Promise.all(
    chunks.map((chunk) => rest<T>(table, `${column}=in.(${chunk.join(",")})`)),
  );
  return pages.flat();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let seed: Promise<Dataset> | undefined;
// The env check is written out in full so the build inlines it and drops the seed chunk
// from builds that use Supabase.
const loadSeed = () =>
  (seed ??= process.env.NEXT_PUBLIC_SUPABASE_URL
    ? Promise.resolve(empty())
    : import("@/data/seed.json").then((m) => m.default as unknown as Dataset));

/** Fills in the schools, tournaments, courses, rounds and tees around the given results. */
async function around(data: Dataset): Promise<Dataset> {
  const [schools, tournaments, rounds] = await Promise.all([
    byIds<Dataset["schools"][number]>("schools", "id", data.players.map((p) => p.school_id)),
    data.tournaments.length
      ? data.tournaments
      : byIds<Dataset["tournaments"][number]>(
          "tournaments",
          "id",
          data.tournament_results.map((r) => r.tournament_id),
        ),
    byIds<Dataset["rounds"][number]>(
      "rounds",
      "result_id",
      data.tournament_results.map((r) => r.id),
    ),
  ]);
  const [courses, tees] = await Promise.all([
    byIds<Dataset["courses"][number]>("courses", "id", tournaments.map((t) => t.course_id)),
    byIds<Dataset["course_tees"][number]>("course_tees", "id", rounds.map((r) => r.course_tee_id)),
  ]);
  return normalizeNumbers({ ...data, schools, tournaments, rounds, courses, course_tees: tees });
}

/** The rows a player page needs. */
export async function loadPlayerRows(id: string): Promise<Dataset> {
  if (!url || !key) return loadSeed();
  if (!UUID.test(id)) return empty();
  const players = await rest<Dataset["players"][number]>("players", `id=eq.${encodeURIComponent(id)}`);
  if (!players.length) return empty();
  const [results, rankings] = await Promise.all([
    rest<Dataset["tournament_results"][number]>(
      "tournament_results",
      `player_id=eq.${encodeURIComponent(id)}`,
    ),
    rest<Dataset["player_rankings"][number]>("player_rankings", `player_id=eq.${encodeURIComponent(id)}`),
  ]);
  return around({ ...empty(), players, tournament_results: results, player_rankings: rankings });
}

/** The rows a tournament page needs. */
export async function loadTournamentRows(id: string): Promise<Dataset> {
  if (!url || !key) return loadSeed();
  if (!UUID.test(id)) return empty();
  const tournaments = await rest<Dataset["tournaments"][number]>(
    "tournaments",
    `id=eq.${encodeURIComponent(id)}`,
  );
  if (!tournaments.length) return empty();
  const results = await rest<Dataset["tournament_results"][number]>(
    "tournament_results",
    `tournament_id=eq.${encodeURIComponent(id)}`,
  );
  const players = await byIds<Dataset["players"][number]>(
    "players",
    "id",
    results.map((r) => r.player_id),
  );
  return around({ ...empty(), tournaments, tournament_results: results, players });
}
