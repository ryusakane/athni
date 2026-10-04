import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerTable, type PlayerRow } from "@/components/golf/player-table";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatPosition, localizedName } from "@/lib/golf/format";
import { prefectureKey, prefectureLabel } from "@/lib/golf/prefectures";
import { listPlayers } from "@/lib/golf/queries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/players">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDictionary(lang).players.title };
}

export default async function PlayersPage({ params }: PageProps<"/[lang]/players">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);

  const rows: PlayerRow[] = (await listPlayers()).map(({ player, school, stats }) => {
    const name = localizedName(lang, player);
    const prefecture = prefectureKey(player.prefecture ?? school?.prefecture);
    return {
      id: player.id,
      name: name.primary,
      nameAlt: name.secondary,
      school: school ? localizedName(lang, school).primary : null,
      gender: player.gender,
      classOf: player.graduation_year,
      prefecture: prefecture && prefectureLabel(prefecture, lang),
      events: stats.events,
      bestFinish: stats.bestFinish ? formatPosition(stats.bestFinish) : "—",
      scoringAverage: stats.scoringAverage,
      rounds18: stats.rounds18,
      averageDifferential: stats.averageDifferential,
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{dict.players.title}</h1>
      <p className="mt-3 max-w-2xl text-foreground/70">{dict.players.lead}</p>
      <p className="mt-2 max-w-2xl text-xs text-foreground/50">{dict.player.nameNote}</p>
      <div className="mt-8">
        <PlayerTable lang={lang} rows={rows} />
      </div>
    </div>
  );
}
