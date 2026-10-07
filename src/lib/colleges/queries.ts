import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { ClassYear, College, CollegeDataset, Program, Ranking } from "./types";

// College data is read from the bundled JSON at build time (data/scripts/build_colleges.py).
// It moves to the college_* tables in Supabase once those are loaded.

const load = cache(async (): Promise<CollegeDataset> => {
  const file = path.join(process.cwd(), "src", "data", "colleges.json");
  return JSON.parse(await readFile(file, "utf8"));
});

export const CLASS_YEARS: ClassYear[] = ["FR", "SO", "JR", "SR", "GR"];

/** The most recent ranking, preferring the official one (Clippd Scoreboard) when two share a date. */
export function latestRanking(program: Program | undefined): Ranking | null {
  if (!program?.rankings.length) return null;
  return [...program.rankings].sort(
    (a, b) =>
      b.as_of.localeCompare(a.as_of) ||
      Number(b.source.includes("Scoreboard")) - Number(a.source.includes("Scoreboard")),
  )[0];
}

/**
 * The college season a ranking belongs to. Seasons run fall to spring and span two calendar
 * years, so a ranking dated from July onward opens a new season: 2026-08-31 → "2026–27",
 * 2026-05-27 → "2025–26".
 */
export function rankingSeason(ranking: Ranking): string {
  const year = Number(ranking.as_of.slice(0, 4));
  const start = Number(ranking.as_of.slice(5, 7)) >= 7 ? year : year - 1;
  return `${start}–${String(start + 1).slice(-2)}`;
}

/**
 * The one country whose players the site counts (players_by_country keeps every country as data).
 * Japan for now; later this follows the viewer's own country.
 */
export const FOCUS_COUNTRY = "JP";

/** Players from FOCUS_COUNTRY on the team since 2016-17, current roster included. */
export function focusPlayersSince2016(program: Program) {
  return program.players_by_country[FOCUS_COUNTRY] ?? 0;
}

export function rosterSummary(program: Program) {
  const byClass = Object.fromEntries(CLASS_YEARS.map((c) => [c, 0])) as Record<ClassYear, number>;
  for (const player of program.roster) if (player.class_year) byClass[player.class_year]++;
  return {
    total: program.roster.length,
    byClass,
    international: program.roster.filter((p) => p.country && p.country !== "US").length,
    japanese: program.roster.filter((p) => p.country === FOCUS_COUNTRY),
  };
}

export async function listColleges() {
  const { colleges, generated_at } = await load();
  return { colleges, generatedAt: generated_at };
}

export async function getCollege(slug: string): Promise<College | undefined> {
  return (await load()).colleges.find((c) => c.slug === slug);
}

export async function collegeSlugs() {
  return (await load()).colleges.map((c) => c.slug);
}
