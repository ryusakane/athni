"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getSupabase } from "@/lib/supabase/client";
import { Notice } from "./ui";

type ResultRow = {
  id: string;
  player_id: string;
  position: number | null;
  tied: boolean;
  total_score: number | null;
  to_par: number | null;
  status: "finished" | "cut" | "wd" | "dq";
  tournaments: { id: string; name_ja: string; name_en: string | null; start_date: string } | null;
};

// The tournaments in the results records a student claimed. A wrong one (a record merged with
// someone else's) is removed from the profile with ×; it stays listed below so it can be put
// back. Hidden rows live in student_hidden_results (0012_hidden_results.sql).
export function ClaimedResults({ lang, studentId, playerIds }: { lang: Locale; studentId: string; playerIds: string[] }) {
  const t = getAccountDictionary(lang).hiddenResults;
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const key = playerIds.join(",");

  const load = useCallback(async () => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    const supabase = getSupabase();
    const [results, hiddenRows] = await Promise.all([
      supabase
        .from("tournament_results")
        .select("id, player_id, position, tied, total_score, to_par, status, tournaments(id, name_ja, name_en, start_date)")
        .in("player_id", ids),
      supabase.from("student_hidden_results").select("result_id").eq("student_id", studentId),
    ]);
    const list = ((results.data ?? []) as unknown as ResultRow[]).sort((a, b) =>
      (b.tournaments?.start_date ?? "").localeCompare(a.tournaments?.start_date ?? ""),
    );
    setRows(list);
    setHidden(new Set((hiddenRows.data ?? []).map((r) => r.result_id as string)));
  }, [key, studentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [load]);

  async function toggle(resultId: string, hide: boolean) {
    const table = getSupabase().from("student_hidden_results");
    const { error } = hide
      ? await table.insert({ student_id: studentId, result_id: resultId })
      : await table.delete().eq("student_id", studentId).eq("result_id", resultId);
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setHidden((prev) => {
      const next = new Set(prev);
      if (hide) next.add(resultId);
      else next.delete(resultId);
      return next;
    });
  }

  if (!rows || rows.length === 0) return null;

  const describe = (r: ResultRow) => {
    const name = (lang === "en" ? r.tournaments?.name_en : null) ?? r.tournaments?.name_ja ?? "";
    const place =
      r.status !== "finished" ? t.status[r.status] : r.position != null ? `${r.tied ? "T" : ""}${r.position}` : null;
    const score =
      r.total_score != null
        ? `${r.total_score}${r.to_par != null ? ` (${r.to_par > 0 ? "+" : ""}${r.to_par === 0 ? "E" : r.to_par})` : ""}`
        : null;
    return { name, detail: [r.tournaments?.start_date, place, score].filter(Boolean).join(" · ") };
  };

  const shown = rows.filter((r) => !hidden.has(r.id));
  const removed = rows.filter((r) => hidden.has(r.id));

  return (
    <div className="space-y-2">
      <h3 className="pt-2 font-semibold">{t.title}</h3>
      <p className="text-sm text-foreground/70">{t.lead}</p>
      {error && <Notice tone="error">{error}</Notice>}
      <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
        {shown.map((r) => {
          const { name, detail } = describe(r);
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <Link href={`/${lang}/tournaments/${r.tournaments?.id}/`} className="font-medium hover:underline">
                  {name}
                </Link>
                <span className="block text-xs text-foreground/60">{detail}</span>
              </span>
              <button
                type="button"
                onClick={() => toggle(r.id, true)}
                aria-label={t.remove(name)}
                title={t.removeTitle}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/15 text-foreground/60 hover:border-red-500 hover:text-red-600 dark:border-white/20"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {removed.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-foreground/70">{t.removed(removed.length)}</summary>
          <ul className="mt-2 divide-y divide-black/5 dark:divide-white/10">
            {removed.map((r) => {
              const { name, detail } = describe(r);
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-foreground/60">
                  <span>
                    <span className="line-through">{name}</span>
                    <span className="block text-xs">{detail}</span>
                  </span>
                  <button type="button" onClick={() => toggle(r.id, false)} className="text-xs underline">
                    {t.restore}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
