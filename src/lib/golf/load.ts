import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Dataset } from "./types";

// The site is a static export, so data is read once at build time:
// from Supabase when its env vars are set, otherwise from the bundled seed (data/scripts/to_sql.py).

const tables = [
  "schools",
  "players",
  "courses",
  "course_tees",
  "tournaments",
  "tournament_results",
  "rounds",
] as const satisfies readonly (keyof Dataset)[];

const PAGE_SIZE = 1000; // Supabase's default max rows per request

async function fetchTable(url: string, key: string, table: string) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&order=id`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${from + PAGE_SIZE - 1}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`);
    }
    const page: unknown[] = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function loadFromSupabase(url: string, key: string): Promise<Dataset> {
  const entries = await Promise.all(
    tables.map(async (table) => [table, await fetchTable(url, key, table)] as const),
  );
  const data = Object.fromEntries(entries) as Dataset;
  // numeric columns come back as strings from PostgREST
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

async function loadSeed(): Promise<Dataset> {
  const file = path.join(process.cwd(), "src", "data", "seed.json");
  return JSON.parse(await readFile(file, "utf8"));
}

let dataset: Promise<Dataset> | undefined;

export function loadDataset(): Promise<Dataset> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  dataset ??= url && key ? loadFromSupabase(url.replace(/\/$/, ""), key) : loadSeed();
  return dataset;
}
