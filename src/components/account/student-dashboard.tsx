"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getSupabase } from "@/lib/supabase/client";
import {
  type Division,
  type NcaaStatus,
  type PlayerClaim,
  type ResultRequest,
  type StudentDocument,
  type StudentAddress,
  type StudentProfile,
  type TargetCollege,
  type TargetStatus,
  type TestName,
  type TestScore,
} from "@/lib/supabase/account-types";
import { AddressFields } from "./address-fields";
import { ClaimedResults } from "./claimed-results";
import { DocumentList, Documents, UploadButton } from "./documents";
import { AccountHome } from "./account-home";
import { Roadmap } from "./roadmap";
import { accountHref, sectionView, type AccountView, type SectionId } from "./views";
import { buttonClass, DateSelect, Field, Input, inputClass, KanaInput, Notice, Section, secondaryButtonClass, YearSelect } from "./ui";

const testNames: TestName[] = ["toefl_ibt", "ielts", "duolingo", "eiken", "toeic", "sat", "act"];
const targetStatuses: TargetStatus[] = ["interested", "contacted", "applied", "offer", "committed", "dropped"];

type ClaimRow = PlayerClaim & { players: { name_ja: string; name_en: string | null } | null };

type Data = {
  student: StudentProfile;
  parents: { id: string; display_name: string }[];
  tests: TestScore[];
  claims: ClaimRow[];
  requests: ResultRequest[];
  targets: TargetCollege[];
  roadmap: string[];
  docs: StudentDocument[];
};

// The student's own screen. A linked parent sees the same screen for their child (asParent).
export function StudentDashboard({
  lang,
  studentId,
  asParent,
  view,
}: {
  lang: Locale;
  studentId: string;
  asParent: boolean;
  view: AccountView;
}) {
  const t = getAccountDictionary(lang);
  const s = t.student;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [student, links, tests, claims, requests, targets, roadmap, docs] = await Promise.all([
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
      supabase.from("student_roadmap_steps").select("step").eq("student_id", studentId),
      supabase.from("student_documents").select("*").eq("student_id", studentId).order("created_at"),
    ]);
    if (student.error) {
      setError(student.error.message);
      return;
    }
    const parentIds = (links.data ?? []).map((l) => l.parent_id as string);
    const parents = parentIds.length
      ? ((await supabase.from("profiles").select("id, display_name").in("id", parentIds)).data ?? [])
      : [];
    setData({
      student: student.data as StudentProfile,
      parents,
      tests: (tests.data ?? []) as TestScore[],
      claims: (claims.data ?? []) as ClaimRow[],
      requests: (requests.data ?? []) as ResultRequest[],
      targets: (targets.data ?? []) as TargetCollege[],
      roadmap: (roadmap.data ?? []).map((row) => row.step as string),
      docs: (docs.data ?? []) as StudentDocument[],
    });
  }, [studentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [load]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-sm">{t.loading}</p>;

  const { student } = data;

  // A parent's links carry the child's id; a student's own links don't need it.
  const linkId = asParent ? studentId : undefined;
  const href = (v: AccountView, hash?: string) => accountHref(lang, v, linkId, hash);
  const sectionHref = (section: SectionId) => href(sectionView[section], section);
  const roadmapInputs = {
    student,
    tests: data.tests,
    targets: data.targets,
    claims: data.claims,
    docs: data.docs,
  };

  switch (view) {
    case "home":
      return <AccountHome lang={lang} inputs={roadmapInputs} manual={data.roadmap} href={href} />;
    case "roadmap":
      return (
        <>
          <Roadmap lang={lang} {...roadmapInputs} manual={data.roadmap} onChange={load} sectionHref={sectionHref} />
          <Targets lang={lang} studentId={studentId} targets={data.targets} onChange={load} />
        </>
      );
    case "golf":
      return (
        <>
          <GolfForm lang={lang} student={student} onSaved={load} />
          <Results lang={lang} studentId={studentId} claims={data.claims} requests={data.requests} onChange={load} />
        </>
      );
    case "school":
      return (
        <>
          <AcademicsForm lang={lang} student={student} onSaved={load} />
          <TestScores lang={lang} studentId={studentId} tests={data.tests} docs={data.docs} onChange={load} />
          <Documents lang={lang} studentId={studentId} docs={data.docs} onChange={load} />
        </>
      );
    case "settings":
      return (
        <>
          {!asParent && (
            <Section id="sharing" title={s.sharing}>
              <VisibilityToggle lang={lang} student={student} onChange={load} />
              {data.parents.length > 0 && (
                <LinkedParents lang={lang} studentId={studentId} parents={data.parents} onChange={load} />
              )}
              <ParentInvite lang={lang} code={student.parent_invite_code} onChange={load} />
            </Section>
          )}
          <ProfileForm lang={lang} student={student} onSaved={load} />
          {!asParent && (
            <Link href={`/${lang}/account/password/`} className={secondaryButtonClass}>
              {t.account.changePassword}
            </Link>
          )}
        </>
      );
  }
}

function LinkedParents({
  lang,
  studentId,
  parents,
  onChange,
}: {
  lang: Locale;
  studentId: string;
  parents: { id: string; display_name: string }[];
  onChange: () => void;
}) {
  const s = getAccountDictionary(lang).student;
  async function unlink(parentId: string) {
    await getSupabase().from("guardian_links").delete().eq("parent_id", parentId).eq("student_id", studentId);
    onChange();
  }
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">{s.linkedParents}</p>
      <ul className="divide-y divide-black/5 dark:divide-white/10">
        {parents.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-4 py-2">
            <span>{p.display_name}</span>
            <button type="button" onClick={() => unlink(p.id)} className="whitespace-nowrap text-xs underline">
              {s.unlinkParent}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ParentInvite({ lang, code, onChange }: { lang: Locale; code: string; onChange: () => void }) {
  const s = getAccountDictionary(lang).student;
  async function rotate() {
    await getSupabase().rpc("rotate_parent_invite_code");
    onChange();
  }
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
      <button type="button" onClick={rotate} className={secondaryButtonClass}>
        {s.newCode}
      </button>
      <p className="text-xs text-foreground/60">{s.newCodeNote}</p>
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

type Status = { tone: "error" | "success"; text: string } | null;

// Splits a name saved before the parts existed ("山田 太郎") at the first space.
function splitName(full: string | null, givenFirst = false): [string, string] {
  const [first = "", ...rest] = (full ?? "").trim().split(/\s+/);
  const second = rest.join(" ");
  return givenFirst ? [second, first] : [first, second];
}

// Reads a form, saves the given columns of student_profiles and reports back.
function useSave(student: StudentProfile, onSaved: () => void, lang: Locale) {
  const t = getAccountDictionary(lang);
  const [status, setStatus] = useState<Status>(null);
  async function save(values: Partial<StudentProfile>) {
    const { error } = await getSupabase().from("student_profiles").update(values).eq("user_id", student.user_id);
    setStatus(error ? { tone: "error", text: error.message } : { tone: "success", text: t.saved });
    if (!error) onSaved();
  }
  return { status, save };
}

function reader(form: FormData) {
  const text = (name: string) => String(form.get(name) ?? "").trim() || null;
  const num = (name: string) => {
    const v = text(name);
    return v == null ? null : Number(v);
  };
  return { text, num };
}

const joinName = (...parts: (string | null)[]) => parts.filter(Boolean).join(" ") || null;

function SaveRow({ lang, status }: { lang: Locale; status: Status }) {
  const t = getAccountDictionary(lang);
  return (
    <>
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <button type="submit" className={buttonClass}>
        {t.save}
      </button>
    </>
  );
}

type FormProps = { lang: Locale; student: StudentProfile; onSaved: () => void };

function ProfileForm({ lang, student, onSaved }: FormProps) {
  const t = getAccountDictionary(lang);
  const s = t.student;
  const { status, save } = useSave(student, onSaved, lang);
  const [familyJa, givenJa] = splitName(student.name_ja);
  const [familyKana, givenKana] = splitName(student.name_kana);
  const [familyEn, givenEn] = splitName(student.name_en, true);
  const thisYear = new Date().getFullYear();
  // The street address lives in its own table that coaches cannot read.
  const [address, setAddress] = useState<StudentAddress | null | undefined>(undefined);

  useEffect(() => {
    getSupabase()
      .from("student_addresses")
      .select("*")
      .eq("student_id", student.user_id)
      .maybeSingle()
      .then(({ data }) => setAddress((data as StudentAddress | null) ?? null));
  }, [student.user_id]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { text, num } = reader(new FormData(event.currentTarget));
    await getSupabase().from("student_addresses").upsert({
      student_id: student.user_id,
      postal_code: text("postal_code"),
      address_line: text("address_line"),
      updated_at: new Date().toISOString(),
    });
    save({
      family_name_ja: text("family_name_ja"),
      given_name_ja: text("given_name_ja"),
      family_name_kana: text("family_name_kana"),
      given_name_kana: text("given_name_kana"),
      family_name_en: text("family_name_en"),
      given_name_en: text("given_name_en"),
      // The joined names are what coach screens and result claims show.
      name_ja: joinName(text("family_name_ja"), text("given_name_ja")),
      name_kana: joinName(text("family_name_kana"), text("given_name_kana")),
      name_en: joinName(text("given_name_en"), text("family_name_en")),
      birth_date: text("birth_date"),
      gender: text("gender") as StudentProfile["gender"],
      hometown: text("hometown"),
      country: text("country"),
      prefecture: text("prefecture"),
      height_cm: num("height_cm"),
      handedness: text("handedness") as StudentProfile["handedness"],
      bio: text("bio"),
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <Section id="profile" title={s.profile}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={s.familyNameJa}>
            <Input name="family_name_ja" defaultValue={student.family_name_ja ?? familyJa} placeholder="山田" />
          </Field>
          <Field label={s.givenNameJa}>
            <Input name="given_name_ja" defaultValue={student.given_name_ja ?? givenJa} placeholder="太郎" />
          </Field>
          <Field label={t.familyKana}>
            <KanaInput name="family_name_kana" defaultValue={student.family_name_kana ?? familyKana} placeholder="ヤマダ" />
          </Field>
          <Field label={t.givenKana}>
            <KanaInput name="given_name_kana" defaultValue={student.given_name_kana ?? givenKana} placeholder="タロウ" />
          </Field>
          <Field label={s.familyNameEn}>
            <Input name="family_name_en" defaultValue={student.family_name_en ?? familyEn} placeholder="Yamada" />
          </Field>
          <Field label={s.givenNameEn}>
            <Input name="given_name_en" defaultValue={student.given_name_en ?? givenEn} placeholder="Taro" />
          </Field>
          <Field label={s.birthDate}>
            <DateSelect
              name="birth_date"
              defaultValue={student.birth_date}
              fromYear={1950}
              toYear={thisYear}
              labels={{ year: t.year, month: t.month, day: t.day }}
            />
          </Field>
          <Field label={s.gender}>
            <select name="gender" defaultValue={student.gender ?? ""} className={inputClass}>
              <option value="">—</option>
              <option value="male">{s.male}</option>
              <option value="female">{s.female}</option>
            </select>
          </Field>
          <Field label={s.hometown}>
            <Input name="hometown" defaultValue={student.hometown ?? ""} />
          </Field>
          {address !== undefined && (
            <AddressFields
              lang={lang}
              defaults={{
                country: student.country,
                prefecture: student.prefecture,
                postal_code: address?.postal_code,
                address_line: address?.address_line,
              }}
            />
          )}
          <Field label={s.heightCm}>
            <Input name="height_cm" type="number" min={100} max={250} defaultValue={student.height_cm ?? ""} />
          </Field>
          <Field label={s.handedness}>
            <select name="handedness" defaultValue={student.handedness ?? ""} className={inputClass}>
              <option value="">—</option>
              <option value="right">{s.right}</option>
              <option value="left">{s.left}</option>
            </select>
          </Field>
        </div>
        <Field label={s.bio}>
          <textarea name="bio" rows={4} defaultValue={student.bio ?? ""} className={inputClass} />
        </Field>
        <SaveRow lang={lang} status={status} />
      </Section>
    </form>
  );
}

const divisions: Division[] = ["d1", "d2", "d3", "naia", "njcaa"];
const ncaaStatuses: NcaaStatus[] = ["not_registered", "registered", "certified"];

function AcademicsForm({ lang, student, onSaved }: FormProps) {
  const t = getAccountDictionary(lang);
  const s = t.student;
  const { status, save } = useSave(student, onSaved, lang);
  const thisYear = new Date().getFullYear();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { text, num } = reader(form);
    save({
      school_name: text("school_name"),
      graduation_year: num("graduation_year"),
      entry_year: num("entry_year"),
      gpa_jp: num("gpa_jp"),
      gpa_us: num("gpa_us"),
      class_rank: num("class_rank"),
      class_size: num("class_size"),
      intended_major: text("intended_major"),
      target_divisions: form.getAll("target_divisions") as Division[],
      ncaa_status: text("ncaa_status") as NcaaStatus | null,
      ncaa_eligibility_id: text("ncaa_eligibility_id"),
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <Section id="academics" title={s.academics}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={s.school}>
            <Input name="school_name" defaultValue={student.school_name ?? ""} />
          </Field>
          <Field label={t.signup.graduationYear}>
            <YearSelect
              name="graduation_year"
              fromYear={2000}
              toYear={thisYear + 6}
              defaultValue={student.graduation_year != null ? String(student.graduation_year) : ""}
              placeholder={t.year}
            />
          </Field>
          <Field label={s.entryYear}>
            <YearSelect
              name="entry_year"
              fromYear={thisYear}
              toYear={thisYear + 7}
              defaultValue={student.entry_year != null ? String(student.entry_year) : ""}
              placeholder={t.year}
            />
          </Field>
          <Field label={s.gpaJp}>
            <Input name="gpa_jp" type="number" step="0.1" min="1" max="5" defaultValue={student.gpa_jp ?? ""} />
          </Field>
          <Field label={s.gpaUs}>
            <Input name="gpa_us" type="number" step="0.01" min="0" max="4" defaultValue={student.gpa_us ?? ""} />
          </Field>
          <Field label={s.classRank}>
            <Input name="class_rank" type="number" min={1} defaultValue={student.class_rank ?? ""} />
          </Field>
          <Field label={s.classSize}>
            <Input name="class_size" type="number" min={1} defaultValue={student.class_size ?? ""} />
          </Field>
          <Field label={s.major}>
            <Input name="intended_major" defaultValue={student.intended_major ?? ""} />
          </Field>
        </div>
        <fieldset className="text-sm">
          <legend className="mb-1 font-medium">{s.divisions}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {divisions.map((d) => (
              <label key={d} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="target_divisions"
                  value={d}
                  defaultChecked={student.target_divisions?.includes(d)}
                />
                {s.divisionNames[d]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={s.ncaaStatus}>
            <select name="ncaa_status" defaultValue={student.ncaa_status ?? ""} className={inputClass}>
              <option value="">—</option>
              {ncaaStatuses.map((v) => (
                <option key={v} value={v}>
                  {s.ncaaStatuses[v]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={s.ncaaId}>
            <Input name="ncaa_eligibility_id" defaultValue={student.ncaa_eligibility_id ?? ""} />
          </Field>
        </div>
        <p className="text-xs text-foreground/60">{s.ncaaNote}</p>
        <SaveRow lang={lang} status={status} />
      </Section>
    </form>
  );
}

function GolfForm({ lang, student, onSaved }: FormProps) {
  const t = getAccountDictionary(lang);
  const s = t.student;
  const { status, save } = useSave(student, onSaved, lang);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { text, num } = reader(new FormData(event.currentTarget));
    save({
      handicap: num("handicap"),
      scoring_average: num("scoring_average"),
      scoring_rounds: num("scoring_rounds"),
      best_18: num("best_18"),
      best_18_event: text("best_18_event"),
      driving_distance_yd: num("driving_distance_yd"),
      wagr_rank: num("wagr_rank"),
      home_course: text("home_course"),
      ranking_url: text("ranking_url"),
      video_url: text("video_url"),
      coach_name: text("coach_name"),
      coach_contact: text("coach_contact"),
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <Section id="golf" title={s.golf}>
        <p className="text-sm text-foreground/70">{s.golfNote}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={s.scoringAverage}>
            <Input name="scoring_average" type="number" step="0.1" min={50} max={150} defaultValue={student.scoring_average ?? ""} />
          </Field>
          <Field label={s.scoringRounds}>
            <Input name="scoring_rounds" type="number" min={0} defaultValue={student.scoring_rounds ?? ""} />
          </Field>
          <Field label={s.handicap}>
            <Input name="handicap" type="number" step="0.1" defaultValue={student.handicap ?? ""} />
          </Field>
          <Field label={s.drivingDistance}>
            <Input name="driving_distance_yd" type="number" min={100} max={450} defaultValue={student.driving_distance_yd ?? ""} />
          </Field>
          <Field label={s.best18}>
            <Input name="best_18" type="number" min={50} max={150} defaultValue={student.best_18 ?? ""} />
          </Field>
          <Field label={s.best18Event}>
            <Input name="best_18_event" defaultValue={student.best_18_event ?? ""} />
          </Field>
          <Field label={s.wagrRank}>
            <Input name="wagr_rank" type="number" min={1} defaultValue={student.wagr_rank ?? ""} />
          </Field>
          <Field label={s.homeCourse}>
            <Input name="home_course" defaultValue={student.home_course ?? ""} />
          </Field>
          <Field label={s.rankingUrl}>
            <Input name="ranking_url" type="url" defaultValue={student.ranking_url ?? ""} />
          </Field>
          <Field label={s.video}>
            <Input name="video_url" type="url" defaultValue={student.video_url ?? ""} />
          </Field>
          <Field label={s.coachName}>
            <Input name="coach_name" defaultValue={student.coach_name ?? ""} />
          </Field>
          <Field label={s.coachContact}>
            <Input name="coach_contact" defaultValue={student.coach_contact ?? ""} />
          </Field>
        </div>
        <SaveRow lang={lang} status={status} />
      </Section>
    </form>
  );
}

function TestScores({
  lang,
  studentId,
  tests,
  docs,
  onChange,
}: {
  lang: Locale;
  studentId: string;
  tests: TestScore[];
  docs: StudentDocument[];
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
    <Section id="tests" title={s.tests}>
      {tests.length > 0 && (
        <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
          {tests.map((row) => {
            const reports = docs.filter((d) => d.test_score_id === row.id);
            return (
              <li key={row.id} className="space-y-1 py-2">
                <div className="flex items-center justify-between gap-4">
                  <span>
                    <span className="font-medium">{s.testNames[row.test]}</span> {row.score}
                    {row.taken_on && <span className="text-foreground/60"> · {row.taken_on}</span>}
                  </span>
                  <button type="button" onClick={() => remove(row.id)} className="whitespace-nowrap text-xs underline">
                    {t.remove}
                  </button>
                </div>
                <DocumentList lang={lang} docs={reports} onChange={onChange} />
                {reports.length === 0 && (
                  <UploadButton
                    lang={lang}
                    studentId={studentId}
                    kinds={["test_report"]}
                    testScoreId={row.id}
                    label={s.attachReport}
                    onDone={onChange}
                  />
                )}
              </li>
            );
          })}
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
    <Section id="results" title={s.results}>
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
      <ClaimedResults
        lang={lang}
        studentId={studentId}
        playerIds={claims.filter((c) => c.status !== "rejected").map((c) => c.player_id)}
      />

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
    <Section id="targets" title={s.targets}>
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
