import type { Dataset } from "./types";

// PostgREST reads shared by the build (load.ts) and the Worker (worker/). No Node APIs here.

export type SupabaseConfig = { url: string; key: string };

export async function supabaseGet<T>(
  { url, key }: SupabaseConfig,
  query: string,
  headers: Record<string, string> = {},
): Promise<T[]> {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...headers },
  });
  if (!res.ok) throw new Error(`Supabase ${query}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** numeric columns come back as strings from PostgREST */
export function normalizeNumerics(data: Dataset) {
  for (const tee of data.course_tees) {
    tee.course_rating = tee.course_rating == null ? null : Number(tee.course_rating);
  }
  for (const result of data.tournament_results) {
    result.rank_percentile =
      result.rank_percentile == null ? null : Number(result.rank_percentile);
  }
  for (const round of data.rounds) {
    for (const col of [
      "score_differential",
      "temperature_c",
      "wind_speed_ms",
      "precipitation_mm",
    ] as const) {
      round[col] = round[col] == null ? null : Number(round[col]);
    }
  }
  return data;
}

// Embedded resources (PostgREST `alias:table(...)`) used by the detail-page queries, by alias.
const embeds: Record<string, keyof Dataset> = {
  school: "schools",
  player: "players",
  course: "courses",
  tee: "course_tees",
  tournament: "tournaments",
  tournament_results: "tournament_results",
  rounds: "rounds",
};

/** Splits rows with embedded resources back into flat tables, the shape the views expect. */
export function flattenEmbedded(table: keyof Dataset, rows: object[]): Dataset {
  const tables = new Map<keyof Dataset, Map<string, object>>();
  const collect = (name: keyof Dataset, row: Record<string, unknown>) => {
    const own: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const target = embeds[key];
      if (!target) own[key] = value;
      else if (Array.isArray(value)) value.forEach((v) => collect(target, v));
      else if (value) collect(target, value as Record<string, unknown>);
    }
    if (!tables.has(name)) tables.set(name, new Map());
    tables.get(name)!.set(own.id as string, own);
  };
  rows.forEach((row) => collect(table, row as Record<string, unknown>));
  const all = (name: keyof Dataset) => [...(tables.get(name)?.values() ?? [])];
  return normalizeNumerics({
    schools: all("schools"),
    players: all("players"),
    courses: all("courses"),
    course_tees: all("course_tees"),
    tournaments: all("tournaments"),
    tournament_results: all("tournament_results"),
    rounds: all("rounds"),
  } as Dataset);
}
