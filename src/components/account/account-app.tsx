"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getSupabase } from "@/lib/supabase/client";
import { CoachDashboard } from "./coach-dashboard";
import { ParentDashboard } from "./parent-dashboard";
import { Shell } from "./signup-form";
import { StudentDashboard } from "./student-dashboard";
import { secondaryButtonClass, Notice } from "./ui";
import { useAccount } from "./use-account";

// /account: one page, a different screen for each role.
export function AccountApp({ lang }: { lang: Locale }) {
  const t = getAccountDictionary(lang);
  const account = useAccount();
  const router = useRouter();

  if (account.status === "disabled") {
    return (
      <Shell title={t.account.title}>
        <Notice>{t.notConfigured}</Notice>
      </Shell>
    );
  }
  if (account.status === "loading") {
    return <Shell title={t.account.title}>{t.loading}</Shell>;
  }
  if (account.status !== "signedIn") {
    return (
      <Shell title={t.account.title}>
        <Notice>
          {t.account.needLogin}{" "}
          <Link href={`/${lang}/login/`} className="underline">
            {t.nav.login}
          </Link>
        </Notice>
      </Shell>
    );
  }

  const { session, profile } = account;
  if (!profile) {
    return (
      <Shell title={t.account.title}>
        <Notice tone="error">{t.errorGeneric}</Notice>
      </Shell>
    );
  }

  async function logout() {
    await getSupabase().auth.signOut();
    router.push(`/${lang}/`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{profile.display_name || t.account.title}</h1>
          <p className="mt-1 text-sm text-foreground/60">
            {t.account.roleLabel[profile.role]} · {t.account.signedInAs(session.user.email ?? "")}
          </p>
        </div>
        <button type="button" onClick={logout} className={secondaryButtonClass}>
          {t.account.logout}
        </button>
      </div>
      <div className="mt-8 space-y-6">
        {profile.role === "student" && <StudentDashboard lang={lang} studentId={profile.id} asParent={false} />}
        {profile.role === "parent" && (
          <ParentDashboard
            lang={lang}
            parentId={profile.id}
            pendingInviteCode={session.user.user_metadata?.invite_code}
          />
        )}
        {profile.role === "coach" && <CoachDashboard lang={lang} coachId={profile.id} />}
      </div>
    </div>
  );
}
