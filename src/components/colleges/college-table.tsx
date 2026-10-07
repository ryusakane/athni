"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type ProgramCell = {
  rank: number | null;
  season: string | null;
  roster: number | null;
  japanese: number;
  japaneseSince2016: number;
  collected: boolean;
} | null;

export type CollegeRow = {
  slug: string;
  name: string;
  nickname: string | null;
  division: string;
  conference: string | null;
  state: string | null;
  men: ProgramCell;
  women: ProgramCell;
};

type Sort = "rank" | "name";

const nullsLast = (a: number | null | undefined, b: number | null | undefined) =>
  a == null ? (b == null ? 0 : 1) : b == null ? -1 : a - b;

const inputClass =
  "rounded-md border border-black/15 bg-background px-3 py-2 text-sm dark:border-white/20";

const uniqueSorted = (values: (string | null)[]) =>
  [...new Set(values.filter((v): v is string => !!v))].sort();

export function CollegeTable({ lang, rows }: { lang: Locale; rows: CollegeRow[] }) {
  const dict = getDictionary(lang);
  const t = dict.colleges;
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("");
  const [gender, setGender] = useState<"men" | "women">("men");
  const [conference, setConference] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useState<Sort>("rank");

  const divisions = useMemo(() => uniqueSorted(rows.map((r) => r.division)), [rows]);
  const conferences = useMemo(() => uniqueSorted(rows.map((r) => r.conference)), [rows]);
  const states = useMemo(() => uniqueSorted(rows.map((r) => r.state)), [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        r[gender] &&
        (!division || r.division === division) &&
        (!conference || r.conference === conference) &&
        (!state || r.state === state) &&
        (!q || [r.name, r.nickname, r.conference, r.state].some((v) => v?.toLowerCase().includes(q))),
    );
    const byName = (a: CollegeRow, b: CollegeRow) => a.name.localeCompare(b.name, "en");
    return filtered.sort((a, b) =>
      sort === "rank" ? nullsLast(a[gender]?.rank, b[gender]?.rank) || byName(a, b) : byName(a, b),
    );
  }, [rows, query, division, gender, conference, state, sort]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          className={`${inputClass} min-w-56 flex-1`}
        />
        <select value={gender} onChange={(e) => setGender(e.target.value as "men" | "women")} className={inputClass}>
          <option value="men">{t.men}</option>
          <option value="women">{t.women}</option>
        </select>
        <select value={division} onChange={(e) => setDivision(e.target.value)} className={inputClass}>
          <option value="">{t.allDivisions}</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select value={conference} onChange={(e) => setConference(e.target.value)} className={inputClass}>
          <option value="">{t.allConferences}</option>
          {conferences.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
          <option value="">{t.allStates}</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={inputClass}>
          <option value="rank">{t.sortRank}</option>
          <option value="name">{t.sortName}</option>
        </select>
      </div>

      <p className="mt-4 text-sm text-foreground/60">{t.count(shown.length, rows.filter((r) => r[gender]).length)}</p>

      {shown.length === 0 ? (
        <p className="mt-6 text-foreground/60">{t.noMatch}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-black/10 text-left text-foreground/60 dark:border-white/10">
              <tr>
                <th className="py-2 pr-4 text-right font-medium">{t.rank}</th>
                <th className="py-2 pr-4 font-medium">{t.school}</th>
                <th className="py-2 pr-4 font-medium">{t.conference}</th>
                <th className="py-2 pr-4 font-medium">{t.state}</th>
                <th className="py-2 pr-4 text-right font-medium">{t.roster}</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right font-medium">{t.japanese}</th>
                <th className="whitespace-nowrap py-2 text-right font-medium">{t.japaneseSince2016}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const p = r[gender];
                return (
                  <tr key={r.slug} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {p?.rank ?? "—"}
                      {p?.season && (
                        <span className="block text-xs text-foreground/50">{p.season}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <Link href={`/${lang}/colleges/${r.slug}/?gender=${gender}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      {r.nickname && <span className="ml-2 text-foreground/50">{r.nickname}</span>}
                      {p && !p.collected && (
                        <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-foreground/70">
                          {t.notCollected}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-foreground/70">{r.conference ?? "—"}</td>
                    <td className="py-2 pr-4 text-foreground/70">{r.state ?? "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p?.roster ?? "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p?.japanese || ""}</td>
                    <td className="py-2 text-right tabular-nums">{p?.japaneseSince2016 || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
