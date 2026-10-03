import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function SiteHeader({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const navItems = [
    { href: `/${lang}/players`, label: dict.nav.players },
    { href: `/${lang}/tournaments`, label: dict.nav.tournaments },
    { href: `/${lang}/about`, label: dict.nav.about },
    { href: `/${lang}/contact`, label: dict.nav.contact },
  ];

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href={`/${lang}`} className="text-lg font-semibold tracking-tight">
          Athni
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
      </div>
    </header>
  );
}
