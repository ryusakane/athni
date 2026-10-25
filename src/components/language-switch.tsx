"use client";

import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import type { Locale } from "@/i18n/config";

const names: Record<Locale, string> = { ja: "日本語", en: "English" };

function otherLanguageHref(path: string, lang: Locale, other: Locale) {
  return path.replace(new RegExp(`^/${lang}(?=/|$)`), `/${other}`);
}

/**
 * 日本語 | English, linking to the same page in the other language. Keeps the query string and
 * hash too, since player, tournament and college pages pick what to show from ?id= / ?gender=.
 */
export function LanguageSwitch({ lang }: { lang: Locale }) {
  const other: Locale = lang === "en" ? "ja" : "en";
  const pathname = usePathname() ?? `/${lang}`;

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const { pathname: path, search, hash } = window.location;
    event.currentTarget.href = otherLanguageHref(path, lang, other) + search + hash;
    try {
      localStorage.setItem("athni-lang", other); // read by public/index.html for "/"
    } catch {}
  }

  return (
    <div className="flex items-center gap-1 text-sm" aria-label="Language">
      {(["ja", "en"] as const).map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span className="text-foreground/30">|</span>}
          {l === lang ? (
            <span className="font-medium" aria-current="true">
              {names[l]}
            </span>
          ) : (
            // A plain link: the href is finished on click with the current ?query and #hash.
            <a
              href={otherLanguageHref(pathname, lang, other)}
              hrefLang={l}
              lang={l}
              onClick={onClick}
              className="text-foreground/60 hover:text-foreground"
            >
              {names[l]}
            </a>
          )}
        </span>
      ))}
    </div>
  );
}
