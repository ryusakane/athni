import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { home } = getDictionary(lang);

  return (
    <div className="mx-auto max-w-5xl px-4 py-24">
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
        {home.tagline}
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-foreground/70">{home.lead}</p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          href={`/${lang}/players`}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90"
        >
          {home.ctaPlayers}
        </Link>
        <Link
          href={`/${lang}/tournaments`}
          className="rounded-full border border-black/15 px-6 py-3 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          {home.ctaTournaments}
        </Link>
      </div>
    </div>
  );
}
