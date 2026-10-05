"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";

/** Links to the same page in the other language. */
export function LanguageSwitch({ lang, label }: { lang: Locale; label: string }) {
  const other: Locale = lang === "en" ? "ja" : "en";
  const pathname = usePathname() ?? `/${lang}`;
  const href = pathname.replace(new RegExp(`^/${lang}(?=/|$)`), `/${other}`);
  // A plain link: on detail pages the Worker renders (src/lib/worker-pages.ts) there is no route
  // for Next.js to prefetch, and switching language is rare enough for a full page load.
  return (
    <a href={href} className="hover:text-foreground">
      {label}
    </a>
  );
}
