"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getSupabase } from "@/lib/supabase/client";
import {
  type PlayerClaim,
  type ResultRequest,
  type StudentProfile,
  type TargetCollege,
  type TargetStatus,
  type TestName,
  type TestScore,
} from "@/lib/supabase/account-types";
import { buttonClass, Field, Input, inputClass, Notice, Section, secondaryButtonClass } from "./ui";

const testNames: TestName[] = ["toefl_ibt", "ielts", "duolingo", "eiken", "toeic", "sat", "act"];
const targetStatuses: TargetStatus[] = ["interested", "contacted", "applied", "offer", "committed", "dropped"];

type ClaimRow = PlayerClaim & { players: { name_ja: string; name_en: string | null } | null };

type Data = {
  student: StudentProfile;
  parents: { display_name: string }[];
  tests: TestScore[];
  claims: ClaimRow[];
  requests: ResultRequest[];
  targets: TargetCollege[];
};

// The student's own screen. A linked parent sees the same screen for their child (asParent).
export function StudentDashboard({
  lang,
  studentId,
  asParent,
}: {
  lang: Locale;
  studentId: string;
  asParent: boolean;
}) {
  const t = getAccountDictionary(lang);
  const s = t.student;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [student, links, tests, claims, requests, targets] = await Promise.all([
      supabase.from("student_profiles").select("*").eq("user_id", studentId).single(),
      supabase.from("guardian_links").select("parent_id").eq("student_id", studentId),
      supabase.from("student_test_scores").select("*").eq("student_id", studentId).order("taken_on"),
      supabase
        .from("player_claims")
        .select("*, players(name_ja, name_en)")
        .eq("student_id", studentId)
        .order("created_at"),
      supabase.from("result_requests").select("*").eq("student_id", studentId).order("created_at"),
      supabase.from("student_target_colleges").select("*").eq("student_id", studentId).order("created_at"),
    ]);
    if (student.error) {
      setError(student.error.message);
      return;
    }
    const parentIds = (links.data ?? []).map((l) => l.parent_id as string);
    const parents = parentIds.length
      ? ((await supabase.from("profiles").select("display_name").in("id", parentIds)).data ?? [])
      : [];
    setData({
      student: student.data as StudentProfile,
      parents,
      tests: (tests.data ?? []) as TestScore[],
      claims: (claims.data ?? []) as ClaimRow[],
      requests: (requests.data ?? []) as ResultRequest[],
      targets: (targets.data ?? []) as TargetCollege[],
    });
  }, [studentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [load]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-sm">{t.loading}</p>;

  const { student } = data;

  return (
    <>
      {!asParent && (
        <Section title={s.sharing}>
          <VisibilityToggle lang={lang} student={student} onChange={load} />
          {data.parents.length > 0 ? (
            <p className="text-sm">
              {s.linkedParents}: {data.parents.map((p) => p.display_name).join(", ")}
            </p>
          ) : (
            <ParentInvite lang={lang} code={student.parent_invite_code} />
          )}
        </Section>
      )}
      <ProfileForm lang={lang} student={student} onSaved={load} />
      <TestScores lang={lang} studentId={studentId} tests={data.tests} onChange={load} />
      <Results lang={lang} studentId={studentId} claims={data.claims} requests={data.requests} onChange={load} />
      <Targets lang={lang} studentId={studentId} targets={data.targets} onChange={load} />
    </>
  );
}

function ParentInvite({ lang, code }: { lang: Locale; code: string }) {
  const s = getAccountDictionary(lang).student;
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- window is browser-only
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/${lang}/signup/?role=parent&code=${code}`;
  return (
    <div className="space-y-2 text-sm">
      <p>{s.parentInvite}</p>
      <p className="font-mono text-lg font-bold tracking-widest">{code}</p>
      <p>{s.parentLink}</p>
      <p className="break-all rounded bg-foreground/5 px-2 py-1 font-mono text-xs">{link}</p>
    </div>
  );
}

function VisibilityToggle({
  lang,
  student,
  onChange,
}: {
  lang: Locale;
  student: StudentProfile;
  onChange: () => void;
}) {
  const t = getAccountDictionary(lang);
  const [error, setError] = useState<string | null>(null);
  async function toggle(checked: boolean) {
    const { error } = await getSupabase()
      .from("student_profiles")
      .update({ visible_to_coaches: checked })
      .eq("user_id", student.user_id);
    setError(error ? error.message : null);
    onChange();
  }
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={student.visible_to_coaches}
          onChange={(e) => toggle(e.target.checked)}
        />
        {t.student.visibility}
      </label>
      <p className="mt-1 text-xs text-foreground/60">{t.student.visibilityNote}</p>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

function ProfileForm({
  lang,
  student,
  onSaved,
}: {
  lang: Locale;
  student: StudentProfile;
  onSaved: () => void;
}) {
  const t = getAccountDictionary(lang);
  const s = t.student;
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    const num = (name: string) => {
      const v = text(name);
      return v == null ? null : Number(v);
    };
    const { error } = await getSupabase()
      .from("student_profiles")
      .update({
        name_en: text("name_en"),
        name_ja: text("name_ja"),
        school_name: text("school_name"),
        prefecture: text("prefecture"),
        gender: text("gender"),
        graduation_year: num("graduation_year"),
        bio: text("bio"),
        gpa_jp: num("gpa_jp"),
        gpa_us: num("gpa_us"),
        intended_major: text("intended_major"),
        ncaa_eligibility_id: text("ncaa_eligibility_id"),
        handicap: num("handicap"),
        video_url: text("video_url"),
      })
      .eq("user_id", student.user_id);
    setStatus(error ? { tone: "error", text: error.message } : { tone: "success", text: t.saved });
    if (!error) onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title={s.profile}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={s.nameEn}>
            <Input name="name_en" defaultValue={student.name_en ?? ""} placeholder="Taro Yamada" />
          </Field>
          <Field label={s.nameJa}>
            <Input name="name_ja" defaultValue={student.name_ja ?? ""} placeholder="山田 太郎" />
          </Field>
          <Field label={s.school}>
            <Input name="school_name" defaultValue={student.school_name ?? ""} />
          </Field>
          <Field label={s.prefecture}>
            <Input name="prefecture" defaultValue={student.prefecture ?? ""} />
          </Field>
          <Field label={s.gender}>
            <select name="gender" defaultValue={student.gender ?? ""} className={inputClass}>
              <option value="">—</option>
              <option value="male">{s.male}</option>
              <option value="female">{s.female}</option>
            </select>
          </Field>
          <Field label={t.signup.graduationYear}>
            <Input name="graduation_year" type="number" defaultValue={student.graduation_year ?? ""} />
          </Field>
        </div>
        <Field label={s.bio}>
          <textarea name="bio" rows={4} defaultValue={student.bio ?? ""} className={inputClass} />
        </Field>
      </Section>
      <Section title={s.academics}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={s.gpaJp}>
            <Input name="gpa_jp" type="number" step="0.1" min="1" max="5" defaultValue={student.gpa_jp ?? ""} />
          </Field>
          <Field label={s.gpaUs}>
            <Input name="gpa_us" type="number" step="0.01" min="0" max="4" defaultValue={student.gpa_us ?? ""} />
          </Field>
          <Field label={s.major}>
            <Input name="intended_major" defaultValue={student.intended_major ?? ""} />
          </Field>
          <Field label={s.ncaaId}>
            <Input name="ncaa_eligibility_id" defaultValue={student.ncaa_eligibility_id ?? ""} />
          </Field>
          <Field label={s.handicap}>
            <Input name="handicap" type="number" step="0.1" defaultValue={student.handicap ?? ""} />
          </Field>
          <Field label={s.video}>
            <Input name="video_url" type="url" defaultValue={student.video_url ?? ""} />
          </Field>
        </div>
        {status && <Notice tone={status.tone}>{status.text}</Notice>}
        <button type="submit" className={buttonClass}>
          {t.save}
        </button>
      </Section>
    </form>
  );
}

function TestScores({
  lang,
  studentId,
  tests,
  onChange,
}: {
  lang: Locale;
  studentId: string;
  tests: TestScore[];
  onChange: () => void;
}) {
  const t = getAccountDictionary(lang);
  const s = t.student;
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const { error } = await getSupabase()
      .from("student_test_scores")
      .insert({
        student_id: studentId,
        test: form.get("test"),
        score: String(form.get("score") ?? "").trim(),
        taken_on: String(form.get("taken_on") ?? "") || null,
      });
    if (!error) formEl.reset();
    onChange();
  }
  async function remove(id: string) {
    await getSupabase().from("student_test_scores").delete().eq("id", id);
    onChange();
  }
  return (
    <Section title={s.tests}>
      {tests.length > 0 && (
        <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
          {tests.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-4 py-2">
              <span>
                <span className="font-medium">{s.testNames[row.test]}</span> {row.score}
                {row.taken_on && <span className="text-foreground/60"> · {row.taken_on}</span>}
              </span>
              <button type="button" onClick={() => remove(row.id)} className="whitespace-nowrap text-xs underline">
                {t.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid items-end gap-3 sm:grid-cols-4">
        <Field label={s.test}>
          <select name="test" className={inputClass}>
            {testNames.map((name) => (
              <option key={name} value={name}>
                {s.testNames[name]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={s.score}>
          <Input name="score" required />
        </Field>
        <Field label={s.takenOn}>
          <Input name="taken_on" type="date" />
        </Field>
        <button type="submit" className={secondaryButtonClass}>
          {t.add}
        </button>
      </form>
    </Section>
  );
}

function Results({
  lang,
  studentId,
  claims,
  requests,
  onChange,
}: {
  lang: Locale;
  studentId: string;
  claims: ClaimRow[];
  requests: ResultRequest[];
  onChange: () => void;
}) {
  const t = getAccountDictionary(lang);
  const s = t.student;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    const { error } = await getSupabase().from("result_requests").insert({
      student_id: studentId,
      tournament_name: text("tournament_name"),
      start_date: text("start_date"),
      venue: text("venue"),
      position: text("position"),
      scores: text("scores"),
      source_url: text("source_url"),
      note: text("note"),
    });
    setError(error ? error.message : null);
    if (!error) {
      setOpen(false);
      onChange();
    }
  }

  return (
    <Section title={s.results}>
      <p className="text-sm text-foreground/70">{s.resultsLead}</p>
      {claims.length > 0 && (
        <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
          {claims.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-4 py-2">
              <Link href={`/${lang}/players/${c.player_id}/`} className="font-medium hover:underline">
                {(lang === "en" ? c.players?.name_en : c.players?.name_ja) ?? c.players?.name_ja ?? c.player_id}
              </Link>
              <span className="text-xs text-foreground/60">{s.claimStatus[c.status]}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/${lang}/players/`} className={secondaryButtonClass}>
        {s.findMe}
      </Link>

      <h3 className="pt-2 font-semibold">{s.missing}</h3>
      <p className="text-sm text-foreground/70">{s.missingLead}</p>
      {requests.length > 0 && (
        <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 py-2">
              <span>
                <span className="font-medium">{r.tournament_name}</span>
                {r.start_date && <span className="text-foreground/60"> · {r.start_date}</span>}
                {r.position && <span className="text-foreground/60"> · {r.position}</span>}
              </span>
              <span className="text-xs text-foreground/60">
                {s.requestStatus[r.status]}
                {r.reviewer_note && ` · ${r.reviewer_note}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={s.tournamentName}>
              <Input name="tournament_name" required />
            </Field>
            <Field label={s.startDate}>
              <Input name="start_date" type="date" required />
            </Field>
            <Field label={s.venue}>
              <Input name="venue" />
            </Field>
            <Field label={s.position}>
              <Input name="position" />
            </Field>
            <Field label={s.scores}>
              <Input name="scores" />
            </Field>
            <Field label={s.sourceUrl}>
              <Input name="source_url" type="url" required />
            </Field>
          </div>
          <Field label={s.note}>
            <textarea name="note" rows={2} className={inputClass} />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex gap-3">
            <button type="submit" className={buttonClass}>
              {s.sendRequest}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>
              {t.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={secondaryButtonClass}>
          {s.missing}
        </button>
      )}
    </Section>
  );
}

function Targets({
  lang,
  studentId,
  targets,
  onChange,
}: {
  lang: Locale;
  studentId: string;
  targets: TargetCollege[];
  onChange: () => void;
}) {
  const t = getAccountDictionary(lang);
  const s = t.student;
  const supabase = getSupabase();
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const name = String(new FormData(formEl).get("college_name") ?? "").trim();
    if (!name) return;
    const { error } = await supabase
      .from("student_target_colleges")
      .insert({ student_id: studentId, college_name: name });
    if (!error) formEl.reset();
    onChange();
  }
  async function setStatus(id: string, status: TargetStatus) {
    await supabase.from("student_target_colleges").update({ status }).eq("id", id);
    onChange();
  }
  async function remove(id: string) {
    await supabase.from("student_target_colleges").delete().eq("id", id);
    onChange();
  }
  return (
    <Section title={s.targets}>
      {targets.length > 0 && (
        <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
          {targets.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span className="font-medium">{row.college_name}</span>
              <span className="flex items-center gap-3">
                <select
                  value={row.status}
                  onChange={(e) => setStatus(row.id, e.target.value as TargetStatus)}
                  className={`${inputClass} w-auto py-1`}
                >
                  {targetStatuses.map((status) => (
                    <option key={status} value={status}>
                      {s.targetStatus[status]}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => remove(row.id)} className="whitespace-nowrap text-xs underline">
                  {t.remove}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-3">
        <Input name="college_name" placeholder={s.collegeName} required />
        <button type="submit" className={secondaryButtonClass}>
          {t.add}
        </button>
      </form>
    </Section>
  );
}
