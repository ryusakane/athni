import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function BrowseStatus({
  lang,
  status,
}: {
  lang: Locale;
  status: "loading" | "error" | "notFound";
}) {
  const t = getDictionary(lang).browse;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 text-foreground/60" role="status">
      {t[status]}
    </div>
  );
}
