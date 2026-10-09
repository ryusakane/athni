"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getRoadmapDictionary, steps } from "@/i18n/roadmap";
import type { PlayerClaim, StudentDocument, StudentProfile, TargetCollege, TestScore } from "@/lib/supabase/account-types";
import { roadmapProgress } from "./roadmap";
import type { AccountView } from "./views";

type Inputs = {
  student: StudentProfile;
  tests: TestScore[];
  targets: TargetCollege[];
  claims: PlayerClaim[];
  docs: StudentDocument[];
};

// The student's home after logging in: four entries with one line of status each. Details
// live on each entry's page.
export function AccountHome({
  lang,
  inputs,
  manual,
  href,
}: {
  lang: Locale;
  inputs: Inputs;
  manual: string[];
  href: (view: AccountView) => string;
}) {
  const t = getAccountDictionary(lang);
  const h = t.account.home;
  const r = getRoadmapDictionary(lang);
  const { student, tests, claims } = inputs;
  const { doneCount, current } = roadmapProgress(inputs, manual);
  const linked = claims.filter((c) => c.status === "approved").length;
  const gpa = student.gpa_jp ?? student.gpa_us;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Tile href={href("roadmap")} title={t.account.views.roadmap}>
        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-green-600" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <p>{r.progress(doneCount, steps.length)}</p>
        <p className="font-medium text-foreground">
          {current ? `${r.now}: ${r.steps[current.key].title}` : r.allDone}
        </p>
      </Tile>
      <Tile href={href("golf")} title={t.account.views.golf}>
        <p>
          {h.scoringAverage}: {student.scoring_average ?? "—"}
        </p>
        <p>{r.linkedResults(linked)}</p>
      </Tile>
      <Tile href={href("school")} title={t.account.views.school}>
        <p>
          {h.gpa}: {gpa ?? "—"}
        </p>
        <p>
          {h.tests}: {tests.length}
        </p>
      </Tile>
      <Tile href={href("settings")} title={t.account.views.settings}>
        <p>
          {h.coachVisible}: {student.visible_to_coaches ? r.yes : r.no}
        </p>
      </Tile>
    </div>
  );
}

function Tile({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-black/10 p-5 transition hover:border-foreground/40 hover:bg-foreground/[0.02] dark:border-white/10"
    >
      <h2 className="flex items-center justify-between text-lg font-semibold">
        {title}
        <span aria-hidden="true" className="text-foreground/40">
          →
        </span>
      </h2>
      <div className="mt-3 space-y-1.5 text-sm text-foreground/70">{children}</div>
    </Link>
  );
}
