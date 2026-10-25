"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getSupabase } from "@/lib/supabase/client";
import type { PlayerMatch, StudentAddress, StudentProfile } from "@/lib/supabase/account-types";
import { prefectureLabel } from "@/lib/regions";
import { AddressFields } from "./address-fields";
import { byDate, describeResult, resultSelect, type ResultRow } from "./claimed-results";
import { buttonClass, Field, Input, Notice, Section, secondaryButtonClass } from "./ui";

type Me = Pick<StudentProfile, "user_id" | "name_ja" | "name_en" | "country" | "prefecture" | "school_name">;

type State =
  | { step: "loading" }
  | { step: "needInfo"; me: Me; address: StudentAddress | null }
  | { step: "matches"; me: Me; matches: PlayerMatch[] }
  | { step: "done" };

// The record the student said is them, with its tournaments; unticked ones are left out.
type Picking = { playerId: string; rows: ResultRow[] | null; excluded: Set<string> };

const laterKey = (id: string) => `athni.identity-later.${id}`;

// The first thing a student sees after logging in: results records with the same name and
// the same prefecture / state or high school (player_matches() in 0011_identity_match.sql).
// The student says which are them and which are not. "This is me" opens the record's
// tournaments, all ticked; the student unticks any that are not theirs and sends the rest as
// a claim staff approve (claim_player() in 0014_claim_with_excluded_results.sql). Until the
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
  const [picking, setPicking] = useState<Picking | null>(null);

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

  async function openResults(match: PlayerMatch) {
    setError(null);
    setPicking({ playerId: match.player_id, rows: null, excluded: new Set() });
    const { data, error } = await getSupabase()
      .from("tournament_results")
      .select(resultSelect)
      .eq("player_id", match.player_id);
    if (error) {
      setError(error.message);
      setPicking(null);
      return;
    }
    const rows = byDate((data ?? []) as unknown as ResultRow[]);
    setPicking((prev) => (prev?.playerId === match.player_id ? { ...prev, rows } : prev));
  }

  function tick(resultId: string, mine: boolean) {
    setPicking((prev) => {
      if (!prev) return prev;
      const excluded = new Set(prev.excluded);
      if (mine) excluded.delete(resultId);
      else excluded.add(resultId);
      return { ...prev, excluded };
    });
  }

  function removeMatch(playerId: string) {
    setPicking(null);
    if (state.step !== "matches") return;
    const rest = state.matches.filter((m) => m.player_id !== playerId);
    setState(rest.length ? { ...state, matches: rest } : { step: "done" });
  }

  async function claim(match: PlayerMatch) {
    const excluded = picking?.playerId === match.player_id ? [...picking.excluded] : [];
    const { error } = await getSupabase().rpc("claim_player", {
      student: studentId,
      player: match.player_id,
      excluded,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setSent(true);
    removeMatch(match.player_id);
  }

  async function notMe(match: PlayerMatch) {
    const { error } = await getSupabase()
      .from("student_player_dismissals")
      .insert({ student_id: studentId, player_id: match.player_id });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    removeMatch(match.player_id);
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
                <Link href={`/${lang}/player/?id=${m.player_id}`} target="_blank" className="font-semibold underline">
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
              {picking?.playerId === m.player_id ? (
                <PickResults
                  lang={lang}
                  picking={picking}
                  onTick={tick}
                  onClaim={() => claim(m)}
                  onNotMe={() => notMe(m)}
                  onBack={() => setPicking(null)}
                />
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openResults(m)} className={buttonClass}>
                    {s.isMe}
                  </button>
                  <button type="button" onClick={() => notMe(m)} className={secondaryButtonClass}>
                    {s.notMe}
                  </button>
                </div>
              )}
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

// The tournaments of the record the student said is them, each with a tick box (all ticked).
function PickResults({
  lang,
  picking,
  onTick,
  onClaim,
  onNotMe,
  onBack,
}: {
  lang: Locale;
  picking: Picking;
  onTick: (resultId: string, mine: boolean) => void;
  onClaim: () => Promise<void>;
  onNotMe: () => void;
  onBack: () => void;
}) {
  const s = getAccountDictionary(lang).identity;
  const [busy, setBusy] = useState(false);
  const { rows, excluded } = picking;
  if (!rows) return <p className="mt-3 text-sm">{getAccountDictionary(lang).loading}</p>;
  const chosen = rows.length - excluded.size;

  async function send() {
    setBusy(true);
    await onClaim();
    setBusy(false);
  }

  return (
    <div className="mt-4 space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
      <p className="font-semibold">{s.pickTitle}</p>
      <p className="text-sm text-foreground/70">{s.pickLead}</p>
      <div className="flex flex-wrap gap-3 text-xs">
        <button type="button" onClick={() => rows.forEach((r) => onTick(r.id, true))} className="underline">
          {s.tickAll}
        </button>
        <button type="button" onClick={() => rows.forEach((r) => onTick(r.id, false))} className="underline">
          {s.untickAll}
        </button>
      </div>
      <ul className="max-h-96 divide-y divide-black/5 overflow-y-auto text-sm dark:divide-white/10">
        {rows.map((r) => {
          const { name, detail } = describeResult(r, lang);
          const mine = !excluded.has(r.id);
          return (
            <li key={r.id}>
              <label className="flex cursor-pointer items-start gap-3 py-2">
                <input
                  type="checkbox"
                  checked={mine}
                  onChange={(e) => onTick(r.id, e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span className={mine ? "" : "text-foreground/50 line-through"}>
                  <span className="font-medium">{name}</span>
                  <span className="block text-xs text-foreground/60 no-underline">{detail}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {excluded.size > 0 && chosen > 0 && <p className="text-xs text-foreground/60">{s.excludedNote(excluded.size)}</p>}
      {chosen === 0 && <p className="text-xs text-foreground/60">{s.noneChosen}</p>}
      <div className="flex flex-wrap gap-2">
        {chosen > 0 ? (
          <button type="button" onClick={send} disabled={busy} className={buttonClass}>
            {s.sendChosen(chosen)}
          </button>
        ) : (
          <button type="button" onClick={onNotMe} className={buttonClass}>
            {s.notMe}
          </button>
        )}
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          {s.back}
        </button>
      </div>
    </div>
  );
}
