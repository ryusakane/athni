import { LanguageSwitch } from "@/components/language-switch";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function SiteFooter({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 text-sm text-foreground/60">
        <span>© {new Date().getFullYear()} Athni</span>
        <LanguageSwitch lang={lang} label={dict.footer.language} />
      </div>
    </footer>
  );
}
