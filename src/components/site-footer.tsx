import { LanguageSwitch } from "@/components/language-switch";
import type { Locale } from "@/i18n/config";

export function SiteFooter({ lang }: { lang: Locale }) {
  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 text-sm text-foreground/60">
        <span>© {new Date().getFullYear()} AthNi</span>
        <LanguageSwitch lang={lang} />
      </div>
    </footer>
  );
}
