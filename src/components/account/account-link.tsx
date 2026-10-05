"use client";

import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { useAccount } from "./use-account";

// Header link: "Log in" for visitors, "My account" once signed in. Hidden until auth is set up.
export function AccountLink({ lang }: { lang: Locale }) {
  const account = useAccount();
  const t = getAccountDictionary(lang);
  if (account.status === "disabled" || account.status === "loading") return null;
  const signedIn = account.status === "signedIn";
  return (
    <Link
      href={signedIn ? `/${lang}/account/` : `/${lang}/login/`}
      className="rounded-md border border-black/15 px-3 py-1 text-sm hover:bg-foreground/5 dark:border-white/20"
    >
      {signedIn ? t.nav.account : t.nav.login}
    </Link>
  );
}
