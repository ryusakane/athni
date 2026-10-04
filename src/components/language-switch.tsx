"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";

/** Links to the same page in the other language. */
export function LanguageSwitch({ lang, label }: { lang: Locale; label: string }) {
  const other: Locale = lang === "en" ? "ja" : "en";
  const pathname = usePathname() ?? `/${lang}`;
  const href = pathname.replace(new RegExp(`^/${lang}(?=/|$)`), `/${other}`);
  return (
    <Link href={href} className="hover:text-foreground">
      {label}
    </Link>
  );
}
