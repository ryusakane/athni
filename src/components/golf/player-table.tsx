"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export type PlayerRow = {
  id: string;
  name: string;
  nameAlt: string | null;
  school: string | null;
  gender: "male" | "female";
  classOf: number | null;
  prefecture: string | null;
  events: number;
  bestFinish: string;
  scoringAverage: number | null;
  rounds18: number;
  averageDifferential: number | null;
};

type Sort = "scoring" | "differential" | "name" | "class";

const nullsLast = (a: number | null, b: number | null) =>
  a == null ? (b == null ? 0 : 1) : b == null ? -1 : a - b;

const inputClass =
  "rounded-md border border-black/15 bg-background px-3 py-2 text-sm dark:border-white/20";

export function PlayerTable({ lang, rows }: { lang: Locale; rows: PlayerRow[] }) {
  const dict = getDictionary(lang);
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("");
  const [classOf, setClassOf] = useState("");
  const [sort, setSort] = useState<Sort>("scoring");

  const classes = useMemo(
    () =>
      [...new Set(rows.map((r) => r.classOf).filter((c) => c != null))].sort((a, b) => a - b),
    [rows],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (!gender || r.gender === gender) &&
        (!classOf || String(r.classOf) === classOf) &&
        (!q ||
          [r.name, r.nameAlt, r.school].some((v) => v?.toLowerCase().includes(q))),
    );
    const compare: Record<Sort, (a: PlayerRow, b: PlayerRow) => number> = {
      scoring: (a, b) => nullsLast(a.scoringAverage, b.scoringAverage),
      differential: (a, b) => nullsLast(a.averageDifferential, b.averageDifferential),
      name: (a, b) => a.name.localeCompare(b.name, lang),
      class: (a, b) => nullsLast(a.classOf, b.classOf),
    };
    return filtered.sort((a, b) => compare[sort](a, b) || a.name.localeCompare(b.name, lang));
  }, [rows, query, gender, classOf, sort, lang]);

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.players.search}
          aria-label={dict.players.search}
          className={`${inputClass} min-w-56 flex-1`}
        />
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          aria-label={dict.player.gender}
          className={inputClass}
        >
          <option value="">{dict.players.allGenders}</option>
          <option value="male">{dict.labels.male}</option>
          <option value="female">{dict.labels.female}</option>
        </select>
        <select
          value={classOf}
          onChange={(e) => setClassOf(e.target.value)}
          aria-label={dict.player.classOf}
          className={inputClass}
        >
          <option value="">{dict.players.allClasses}</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              {dict.player.classOf} {c}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label={dict.players.sortBy}
          className={inputClass}
        >
          <option value="scoring">{dict.players.sortScoring}</option>
          <option value="differential">{dict.players.sortDifferential}</option>
          <option value="name">{dict.players.sortName}</option>
          <option value="class">{dict.players.sortClass}</option>
        </select>
      </div>

      <p className="mt-4 text-sm text-foreground/60">
        {dict.players.count(shown.length, rows.length)}
      </p>

      {shown.length === 0 ? (
        <p className="mt-8 text-foreground/70">{dict.players.noMatch}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-black/10 text-left text-foreground/60 dark:border-white/10">
              <tr>
                <th className="py-2 pr-4 font-medium">{dict.table.player}</th>
                <th className="py-2 pr-4 font-medium">{dict.table.school}</th>
                <th className="py-2 pr-4 font-medium">{dict.table.class}</th>
                <th className="py-2 pr-4 text-right font-medium">{dict.player.events}</th>
                <th className="py-2 pr-4 text-right font-medium">{dict.player.bestFinish}</th>
                <th className="py-2 pr-4 text-right font-medium">{dict.player.scoringAverage}</th>
                <th className="py-2 text-right font-medium">{dict.player.averageDifferential}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-4">
                    <Link href={`/${lang}/players/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    {r.nameAlt && (
                      <span className="ml-2 text-xs text-foreground/50">{r.nameAlt}</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-foreground/80">
                    {r.school ?? "—"}
                    {r.prefecture && (
                      <span className="ml-1 text-foreground/50">({r.prefecture})</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{r.classOf ?? "—"}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{r.events}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{r.bestFinish}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {r.scoringAverage?.toFixed(2) ?? "—"}
                    {r.rounds18 > 0 && (
                      <span className="ml-1 text-xs text-foreground/50">({r.rounds18})</span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {r.averageDifferential?.toFixed(1) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
