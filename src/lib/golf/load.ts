import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeNumerics, supabaseGet, type SupabaseConfig } from "./supabase";
import type { Dataset } from "./types";

// List pages and the sitemap are static, so their data is read once at build time:
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

async function fetchTable(config: SupabaseConfig, table: string) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await supabaseGet(config, `${table}?select=*&order=id`, {
      Range: `${from}-${from + PAGE_SIZE - 1}`,
    });
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function loadFromSupabase(config: SupabaseConfig): Promise<Dataset> {
  const entries = await Promise.all(
    tables.map(async (table) => [table, await fetchTable(config, table)] as const),
  );
  return normalizeNumerics(Object.fromEntries(entries) as Dataset);
}

async function loadSeed(): Promise<Dataset> {
  const file = path.join(process.cwd(), "src", "data", "seed.json");
  return JSON.parse(await readFile(file, "utf8"));
}

let dataset: Promise<Dataset> | undefined;

export function loadDataset(): Promise<Dataset> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  dataset ??= url && key ? loadFromSupabase({ url, key }) : loadSeed();
  return dataset;
}
