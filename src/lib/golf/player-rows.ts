import type { PlayerRow } from "@/components/golf/player-table";
import type { Locale } from "@/i18n/config";
import { formatPosition, localizedName } from "./format";
import { prefectureKey, prefectureLabel } from "./prefectures";
import { listPlayers } from "./queries";

/** The players list, served as /[lang]/player-rows.json and loaded by the table in the browser. */
export async function playerRows(lang: Locale): Promise<PlayerRow[]> {
  return (await listPlayers()).map(({ player, school, stats }) => {
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

}
