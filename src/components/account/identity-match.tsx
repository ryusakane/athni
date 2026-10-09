"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getSupabase } from "@/lib/supabase/client";
import type { PlayerMatch, StudentAddress, StudentProfile } from "@/lib/supabase/account-types";
import { prefectureLabel } from "@/lib/regions";
import { AddressFields } from "./address-fields";
import { buttonClass, Field, Input, Notice, Section, secondaryButtonClass } from "./ui";

type Me = Pick<StudentProfile, "user_id" | "name_ja" | "name_en" | "country" | "prefecture" | "school_name">;

type State =
  | { step: "loading" }
  | { step: "needInfo"; me: Me; address: StudentAddress | null }
  | { step: "matches"; me: Me; matches: PlayerMatch[] }
  | { step: "done" };

const laterKey = (id: string) => `athni.identity-later.${id}`;

// The first thing a student sees after logging in: results records with the same name and
// the same prefecture / state or high school (player_matches() in 0011_identity_match.sql).
// The student says which are them (a claim staff approve) and which are not. Until the
// address and high school are in, it asks for them. The account screen shows once nothing is
// left to decide, or the student chooses "Later" (asked again on the next visit).
export function IdentityStep({
  lang,
  studentId,
  children,
}: {
  lang: Locale;
  studentId: string;
  children: ReactNode;
}) {
  const t = getAccountDictionary(lang);
  const s = t.identity;
  const [state, setState] = useState<State>({ step: "loading" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (sessionStorage.getItem(laterKey(studentId))) {
        setState({ step: "done" });
        return;
      }
    } catch {
      // Storage blocked: just ask.
    }
    const supabase = getSupabase();
    const [me, address] = await Promise.all([
      supabase
        .from("student_profiles")
        .select("user_id, name_ja, name_en, country, prefecture, school_name")
        .eq("user_id", studentId)
        .single(),
      supabase.from("student_addresses").select("*").eq("student_id", studentId).maybeSingle(),
    ]);
    if (me.error || !me.data) {
      setState({ step: "done" });
      return;
    }
    const profile = me.data as Me;
    if (!profile.prefecture || !profile.school_name) {
      setState({ step: "needInfo", me: profile, address: (address.data as StudentAddress | null) ?? null });
      return;
    }
    const { data, error } = await supabase.rpc("player_matches", { student: studentId });
    const matches = (data ?? []) as PlayerMatch[];
    setState(error || matches.length === 0 ? { step: "done" } : { step: "matches", me: profile, matches });
  }, [studentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [load]);

  function later() {
    try {
      sessionStorage.setItem(laterKey(studentId), "1");
    } catch {
      // Storage blocked: hidden until the page is reloaded.
    }
    setState({ step: "done" });
  }

  async function saveInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    const supabase = getSupabase();
    const [profile, address] = await Promise.all([
      supabase
        .from("student_profiles")
        .update({ country: text("country"), prefecture: text("prefecture"), school_name: text("school_name") })
        .eq("user_id", studentId),
      supabase.from("student_addresses").upsert({
        student_id: studentId,
        postal_code: text("postal_code"),
        address_line: text("address_line"),
        updated_at: new Date().toISOString(),
      }),
    ]);
    const failed = profile.error ?? address.error;
    if (failed) {
      setError(failed.message);
      return;
    }
    setError(null);
    load();
  }

  async function decide(match: PlayerMatch, isMe: boolean) {
    const supabase = getSupabase();
    const { error } = isMe
      ? await supabase
          .from("player_claims")
          .insert({ student_id: studentId, player_id: match.player_id, source: "profile_match" })
      : await supabase.from("student_player_dismissals").insert({ student_id: studentId, player_id: match.player_id });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    if (isMe) setSent(true);
    if (state.step !== "matches") return;
    const rest = state.matches.filter((m) => m.player_id !== match.player_id);
    setState(rest.length ? { ...state, matches: rest } : { step: "done" });
  }

  if (state.step === "loading") return <p className="text-sm">{t.loading}</p>;

  if (state.step === "done") {
    return (
      <>
        {sent && <Notice tone="success">{s.sent}</Notice>}
        {children}
      </>
    );
  }

  if (state.step === "needInfo") {
    const { me, address } = state;
    return (
      <form onSubmit={saveInfo}>
        <Section id="identity" title={s.needInfoTitle}>
          <p className="text-sm text-foreground/70">{s.needInfo}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <AddressFields
              lang={lang}
              required
              defaults={{
                country: me.country,
                prefecture: me.prefecture,
                postal_code: address?.postal_code,
                address_line: address?.address_line,
              }}
            />
            <Field label={s.school}>
              <Input name="school_name" required defaultValue={me.school_name ?? ""} />
            </Field>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={buttonClass}>
              {s.saveAndFind}
            </button>
            <button type="button" onClick={later} className={secondaryButtonClass}>
              {s.later}
            </button>
          </div>
        </Section>
      </form>
    );
  }

  const name = (lang === "ja" ? state.me.name_ja ?? state.me.name_en : state.me.name_en ?? state.me.name_ja) ?? "";
  return (
    <Section id="identity" title={s.title}>
      <p className="text-sm">{s.intro(name)}</p>
      <p className="text-xs text-foreground/60">{s.caution}</p>
      {sent && <Notice tone="success">{s.sent}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <ul className="space-y-3">
        {state.matches.map((m) => {
          const school = lang === "ja" ? m.school_ja ?? m.school_en : m.school_en ?? m.school_ja;
          const tournament = lang === "ja" ? m.last_tournament_ja ?? m.last_tournament_en : m.last_tournament_en ?? m.last_tournament_ja;
          const matched = [m.prefecture_match && s.prefectureMatch, m.school_match && s.schoolMatch].filter(Boolean);
          return (
            <li key={m.player_id} className="rounded-md border border-black/10 p-4 dark:border-white/10">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/${lang}/players/${m.player_id}/`} target="_blank" className="font-semibold underline">
                  {lang === "ja" ? m.name_ja : m.name_en ?? m.name_ja}
                </Link>
                <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-800 dark:text-green-300">
                  {s.matched}: {matched.join(" · ")}
                </span>
              </div>
              <p className="mt-1 text-sm text-foreground/70">
                {[school, prefectureLabel(m.prefecture, lang), m.graduation_year && s.classOf(m.graduation_year)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-1 text-xs text-foreground/60">
                {s.results(m.result_count)}
                {tournament && ` · ${s.latest}: ${tournament}${m.last_date ? ` (${m.last_date})` : ""}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => decide(m, true)} className={buttonClass}>
                  {s.isMe}
                </button>
                <button type="button" onClick={() => decide(m, false)} className={secondaryButtonClass}>
                  {s.notMe}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={later} className={secondaryButtonClass}>
        {s.later}
      </button>
    </Section>
  );
}
