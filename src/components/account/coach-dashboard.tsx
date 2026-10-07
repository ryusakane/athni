"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getSupabase } from "@/lib/supabase/client";
import type { CoachProfile, StudentProfile } from "@/lib/supabase/account-types";
import { buttonClass, Field, Input, Notice, Section, secondaryButtonClass } from "./ui";

type SavedRow = {
  player_id: string;
  players: { name_ja: string; name_en: string | null; graduation_year: number | null } | null;
};

type Data = {
  coach: CoachProfile;
  saved: SavedRow[];
  students: StudentProfile[];
};

export function CoachDashboard({ lang, coachId }: { lang: Locale; coachId: string }) {
  const t = getAccountDictionary(lang);
  const c = t.coach;
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [coach, saved, students] = await Promise.all([
      supabase.from("coach_profiles").select("*").eq("user_id", coachId).single(),
      supabase
        .from("coach_saved_players")
        .select("player_id, players(name_ja, name_en, graduation_year)")
        .eq("coach_id", coachId)
        .order("created_at", { ascending: false }),
      // RLS returns rows only to verified coaches, and only students who opted in.
      supabase.from("student_profiles").select("*").eq("visible_to_coaches", true),
    ]);
    if (coach.error) {
      setStatus({ tone: "error", text: coach.error.message });
      return;
    }
    setData({
      coach: coach.data as CoachProfile,
      saved: (saved.data ?? []) as unknown as SavedRow[],
      students: (students.data ?? []) as StudentProfile[],
    });
  }, [coachId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [load]);

  if (!data) return status ? <Notice tone="error">{status.text}</Notice> : <p className="text-sm">{t.loading}</p>;
  const verified = data.coach.verification_status === "verified";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error } = await getSupabase()
      .from("coach_profiles")
      .update({
        college_name: String(form.get("college_name") ?? "").trim() || null,
        title: String(form.get("title") ?? "").trim() || null,
      })
      .eq("user_id", coachId);
    setStatus(error ? { tone: "error", text: error.message } : { tone: "success", text: t.saved });
  }

  return (
    <>
      <Notice tone={verified ? "success" : data.coach.verification_status === "rejected" ? "error" : "info"}>
        {c.status[data.coach.verification_status]}
      </Notice>

      <Section title={c.saved}>
        {data.saved.length === 0 ? (
          <p className="text-sm text-foreground/70">{c.savedNone}</p>
        ) : (
          <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
            {data.saved.map((row) => (
              <li key={row.player_id} className="py-2">
                <Link href={`/${lang}/players/${row.player_id}/`} className="font-medium hover:underline">
                  {(lang === "en" ? row.players?.name_en : row.players?.name_ja) ?? row.players?.name_ja ?? row.player_id}
                </Link>
                {row.players?.graduation_year && (
                  <span className="text-foreground/60"> · {row.players.graduation_year}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <Link href={`/${lang}/players/`} className={secondaryButtonClass}>
          {c.browse}
        </Link>
      </Section>

      {verified && (
        <Section title={c.students}>
          {data.students.length === 0 ? (
            <p className="text-sm text-foreground/70">{c.studentsNone}</p>
          ) : (
            <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
              {data.students.map((s) => (
                <li key={s.user_id} className="py-3">
                  <p className="font-medium">
                    {s.name_en ?? s.name_ja}
                    {s.name_en && s.name_ja && <span className="text-foreground/60"> · {s.name_ja}</span>}
                  </p>
                  <p className="text-foreground/70">
                    {[s.school_name, s.graduation_year && `Class of ${s.graduation_year}`, s.entry_year && `Fall ${s.entry_year} start`, s.gpa_us && `GPA ${s.gpa_us}`, s.gpa_jp && `GPA (JP 5.0) ${s.gpa_jp}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-foreground/70">
                    {[
                      s.scoring_average != null && `Avg ${s.scoring_average}${s.scoring_rounds ? ` (${s.scoring_rounds} rds)` : ""}`,
                      s.best_18 != null && `Best ${s.best_18}`,
                      s.handicap != null && `HCP ${s.handicap}`,
                      s.wagr_rank != null && `WAGR ${s.wagr_rank}`,
                      s.driving_distance_yd != null && `${s.driving_distance_yd} yd`,
                      s.target_divisions?.length > 0 && s.target_divisions.map((d) => d.toUpperCase()).join("/"),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {s.bio && <p className="mt-1 text-foreground/70">{s.bio}</p>}
                  {s.video_url && (
                    <a href={s.video_url} target="_blank" rel="noreferrer" className="text-xs underline">
                      Video
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <form onSubmit={onSubmit}>
        <Section title={c.profile}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={c.collegeName}>
              <Input name="college_name" defaultValue={data.coach.college_name ?? ""} />
            </Field>
            <Field label={c.title}>
              <Input name="title" defaultValue={data.coach.title ?? ""} />
            </Field>
          </div>
          {status && <Notice tone={status.tone}>{status.text}</Notice>}
          <button type="submit" className={buttonClass}>
            {t.save}
          </button>
        </Section>
      </form>
    </>
  );
}
