import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatDateRange, localizedName } from "@/lib/golf/format";
import { listTournaments } from "@/lib/golf/queries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/tournaments">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDictionary(lang).tournaments.title };
}

export default async function TournamentsPage({ params }: PageProps<"/[lang]/tournaments">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);

  const tournaments = await listTournaments();
  const years = [...new Set(tournaments.map((t) => t.tournament.start_date.slice(0, 4)))];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{dict.tournaments.title}</h1>
      <p className="mt-3 max-w-2xl text-foreground/70">{dict.tournaments.lead}</p>

      {years.map((year) => (
        <section key={year} className="mt-10">
          <h2 className="text-xl font-semibold">{year}</h2>
          <ul className="mt-3 divide-y divide-black/5 dark:divide-white/5">
            {tournaments
              .filter((t) => t.tournament.start_date.startsWith(year))
              .map(({ tournament, course, winners }) => (
                <li key={tournament.id} className="py-3">
                  <Link
                    href={`/${lang}/tournaments/${tournament.id}`}
                    className="font-medium hover:underline"
                  >
                    {localizedName(lang, tournament).primary}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-foreground/60">
                    <span>{formatDateRange(lang, tournament.start_date, tournament.end_date)}</span>
                    {course && <span>{localizedName(lang, course).primary}</span>}
                    {tournament.level && tournament.level in dict.labels && (
                      <span>{dict.labels[tournament.level as keyof typeof dict.labels]}</span>
                    )}
                    {tournament.field_size && (
                      <span>
                        {dict.tournaments.field} {tournament.field_size}
                      </span>
                    )}
                    {winners.length > 0 && (
                      <span>
                        {dict.tournaments.winner}:{" "}
                        {winners.map((w, i) => (
                          <span key={w.id}>
                            {i > 0 && ", "}
                            <Link href={`/${lang}/players/${w.id}`} className="hover:underline">
                              {localizedName(lang, w).primary}
                            </Link>
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
