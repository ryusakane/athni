import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TournamentView } from "@/components/golf/tournament-view";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

// One static page for every tournament: the id comes from ?id= and the rows load in the browser,
// so adding tournaments does not add files to the export.

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/tournament">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDictionary(lang).tournaments.title };
}

export default async function Page({ params }: PageProps<"/[lang]/tournament">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <TournamentView lang={lang} />;
}
