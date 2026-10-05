import Link from "next/link";
import { AccountLink } from "@/components/account/account-link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function SiteHeader({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const navItems = [
    { href: `/${lang}/players`, label: dict.nav.players },
    { href: `/${lang}/tournaments`, label: dict.nav.tournaments },
    { href: `/${lang}/colleges`, label: dict.nav.colleges },
    { href: `/${lang}/about`, label: dict.nav.about },
    { href: `/${lang}/contact`, label: dict.nav.contact },
  ];

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-5">
        {/* Logo guidelines: supplied artwork only, at least 120px wide. */}
        <Link href={`/${lang}`} className="shrink-0" aria-label="AthNi">
          {/* Static export has no image optimizer; SVGs need none. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/wordmark-black.svg"
            alt="AthNi"
            width={120}
            height={36}
            className="h-9 w-[120px] dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/wordmark-white.svg"
            alt="AthNi"
            width={120}
            height={36}
            className="hidden h-9 w-[120px] dark:block"
          />
        </Link>
        <nav className="flex gap-4 text-sm sm:gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-foreground/70 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <AccountLink lang={lang} />
      </div>
    </header>
  );
}
