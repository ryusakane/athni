"use client";

import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { getRoadmapDictionary, steps, type StepDef, type StepKey } from "@/i18n/roadmap";
import { getSupabase } from "@/lib/supabase/client";
import type { StudentProfile, TargetCollege, TestScore } from "@/lib/supabase/account-types";
import { buttonClass, Section, secondaryButtonClass } from "./ui";

type Inputs = {
  student: StudentProfile;
  tests: TestScore[];
  targets: TargetCollege[];
  approvedClaims: number;
};

const reached = (targets: TargetCollege[], statuses: TargetCollege["status"][]) =>
  targets.some((t) => statuses.includes(t.status));

// Steps the profile data already shows as done.
function autoDone({ student, tests, targets, approvedClaims }: Inputs): Partial<Record<StepKey, boolean>> {
  const has = (...names: TestScore["test"][]) => tests.some((t) => names.includes(t.test));
  return {
    goal: student.entry_year != null && student.target_divisions.length > 0,
    grades: student.gpa_jp != null || student.gpa_us != null,
    english: has("toefl_ibt", "ielts", "duolingo"),
    results: student.scoring_average != null || approvedClaims > 0,
    ncaa: student.ncaa_status === "registered" || student.ncaa_status === "certified",
    profile:
      student.visible_to_coaches &&
      Boolean(student.name_en) &&
      student.graduation_year != null &&
      student.scoring_average != null,
    video: Boolean(student.video_url),
    list: targets.filter((t) => t.status !== "dropped").length >= 5,
    contact: reached(targets, ["contacted", "applied", "offer", "committed"]),
    tests: has("sat", "act"),
    offer: reached(targets, ["offer", "committed"]),
    commit: reached(targets, ["committed"]),
    documents: student.ncaa_status === "certified",
  };
}

// The step's "by" month: monthsBefore counted back from August of the start year.
const dueDate = (step: StepDef, entryYear: number) => new Date(entryYear, 7 - step.monthsBefore, 1);

export function Roadmap({
  lang,
  manual,
  onChange,
  ...inputs
}: Inputs & { lang: Locale; manual: string[]; onChange: () => void }) {
  const r = getRoadmapDictionary(lang);
  const auto = autoDone(inputs);
  const isDone = (key: StepKey) => Boolean(auto[key]) || manual.includes(key);
  const doneCount = steps.filter((s) => isDone(s.key)).length;
  const current = steps.find((s) => !isDone(s.key));
  const upNext = current ? steps.slice(steps.indexOf(current) + 1).find((s) => !isDone(s.key)) : undefined;
  const [showAll, setShowAll] = useState(false);
  const entryYear = inputs.student.entry_year;
  const studentId = inputs.student.user_id;

  async function toggle(key: StepKey, done: boolean) {
    const table = getSupabase().from("student_roadmap_steps");
    if (done) await table.insert({ student_id: studentId, step: key });
    else await table.delete().eq("student_id", studentId).eq("step", key);
    onChange();
  }

  const stepProps = { lang, entryYear, auto, isDone, toggle };

  return (
    <Section title={r.title}>
      <p className="text-sm text-foreground/70">{r.lead}</p>
      <div>
        <div className="flex justify-between text-sm font-medium">
          <span>{r.progress(doneCount, steps.length)}</span>
          <span>{Math.round((doneCount / steps.length) * 100)}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-green-600" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>

      {current ? (
        <div className="rounded-lg border-2 border-foreground/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
            {r.now} · {r.phases[current.phase].title}
          </p>
          <StepBody step={current} open {...stepProps} />
        </div>
      ) : (
        <p className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-800 dark:text-green-300">{r.allDone}</p>
      )}
      {upNext && (
        <p className="text-sm">
          <span className="font-medium">{r.next}:</span> {r.steps[upNext.key].title}
        </p>
      )}
      {entryYear == null && <p className="text-xs text-foreground/60">{r.noEntryYear}</p>}

      <button type="button" onClick={() => setShowAll((v) => !v)} className={secondaryButtonClass}>
        {showAll ? r.hideAll : r.showAll}
      </button>
      {showAll && (
        <ol className="space-y-5">
          {(Object.keys(r.phases) as (keyof typeof r.phases)[]).map((phase, i) => (
            <li key={phase}>
              <p className="font-semibold">
                {i + 1}. {r.phases[phase].title}
                <span className="ml-2 text-xs font-normal text-foreground/60">{r.phases[phase].when}</span>
              </p>
              <ul className="mt-2 divide-y divide-black/5 dark:divide-white/10">
                {steps
                  .filter((s) => s.phase === phase)
                  .map((s) => (
                    <li key={s.key} className="py-2">
                      <details>
                        <summary className="flex cursor-pointer list-none items-center gap-3 text-sm">
                          <Mark done={isDone(s.key)} current={s === current} />
                          <span className={isDone(s.key) ? "text-foreground/60" : "font-medium"}>
                            {r.steps[s.key].title}
                          </span>
                        </summary>
                        <div className="pl-8">
                          <StepBody step={s} open={false} {...stepProps} />
                        </div>
                      </details>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-foreground/60">{r.disclaimer}</p>
    </Section>
  );
}

function Mark({ done, current }: { done: boolean; current: boolean }) {
  const style = done
    ? "border-green-600 bg-green-600 text-white"
    : current
      ? "border-foreground"
      : "border-foreground/30";
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${style}`}
    >
      {done ? "✓" : ""}
    </span>
  );
}

// One step's detail. `open` is the "Now" card, which shows the title large.
function StepBody({
  step,
  open,
  lang,
  entryYear,
  auto,
  isDone,
  toggle,
}: {
  step: StepDef;
  open: boolean;
  lang: Locale;
  entryYear: number | null;
  auto: Partial<Record<StepKey, boolean>>;
  isDone: (key: StepKey) => boolean;
  toggle: (key: StepKey, done: boolean) => void;
}) {
  const r = getRoadmapDictionary(lang);
  const text = r.steps[step.key];
  const done = isDone(step.key);
  const due = entryYear != null ? dueDate(step, entryYear) : null;
  const late = due != null && !done && due < new Date();
  return (
    <div className="mt-1 space-y-3 text-sm">
      {open && <h3 className="text-xl font-bold">{text.title}</h3>}
      <p className="text-foreground/70">{text.why}</p>
      {due && (
        <p className={`text-xs font-medium ${late ? "text-amber-700 dark:text-amber-400" : "text-foreground/60"}`}>
          {r.by(due)}
        </p>
      )}
      <ul className="list-disc space-y-1 pl-5">
        {text.todo.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {text.auto && !auto[step.key] && <p className="text-xs text-foreground/60">{text.auto}</p>}
      {text.sources.length > 0 && (
        <p className="text-xs text-foreground/60">
          {r.sources}:{" "}
          {text.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && " · "}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                {s.label}
              </a>
            </span>
          ))}
        </p>
      )}
      {auto[step.key] ? (
        <p className="text-xs font-medium text-green-700 dark:text-green-400">✓ {r.autoDone}</p>
      ) : done ? (
        <button type="button" onClick={() => toggle(step.key, false)} className="text-xs underline">
          {r.undo}
        </button>
      ) : (
        <button type="button" onClick={() => toggle(step.key, true)} className={open ? buttonClass : secondaryButtonClass}>
          {r.markDone}
        </button>
      )}
    </div>
  );
}
