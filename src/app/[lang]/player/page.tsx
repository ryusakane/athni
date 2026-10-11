import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerView } from "@/components/golf/player-view";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

// One static page for every player: the id comes from ?id= and the rows load in the browser,
// so adding players does not add files to the export.

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/player">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDictionary(lang).players.title };
}

export default async function Page({ params }: PageProps<"/[lang]/player">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <PlayerView lang={lang} />;
}
