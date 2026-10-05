import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerActions } from "@/components/account/player-actions";
import { Stat } from "@/components/golf/stat";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import {
  formatDate,
  formatNumber,
  formatPosition,
  formatToPar,
  localizedName,
} from "@/lib/golf/format";
import { prefectureKey, prefectureLabel } from "@/lib/golf/prefectures";
import { getPlayer, playerIds } from "@/lib/golf/queries";

export async function generateStaticParams() {
  return (await playerIds()).map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/players/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  if (!hasLocale(lang)) return {};
  const data = await getPlayer(id);
  return data ? { title: localizedName(lang, data.player).primary } : {};
}

export default async function PlayerPage({ params }: PageProps<"/[lang]/players/[id]">) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const data = await getPlayer(id);
  if (!data) notFound();
  const dict = getDictionary(lang);
  const { player, school, stats, history } = data;

  const name = localizedName(lang, player);
  const prefecture = prefectureKey(player.prefecture ?? school?.prefecture);
  const facts = [
    { label: dict.player.school, value: school && localizedName(lang, school).primary },
    { label: dict.player.classOf, value: player.graduation_year },
    { label: dict.player.prefecture, value: prefecture && prefectureLabel(prefecture, lang) },
    { label: dict.player.gender, value: dict.labels[player.gender] },
  ].filter((f) => f.value != null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{name.primary}</h1>
      {name.secondary && <p className="mt-1 text-lg text-foreground/60">{name.secondary}</p>}
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="inline text-foreground/60">{f.label}: </dt>
            <dd className="inline font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>
      <PlayerActions lang={lang} playerId={player.id} />

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={dict.player.events} value={stats.events} />
        <Stat label={dict.player.wins} value={stats.wins} />
        <Stat label={dict.player.topTens} value={stats.topTens} />
        <Stat
          label={dict.player.bestFinish}
          value={stats.bestFinish ? formatPosition(stats.bestFinish) : "—"}
        />
        <Stat
          label={dict.player.scoringAverage}
          value={formatNumber(stats.scoringAverage, 2)}
          note={dict.player.scoringAverageNote(stats.rounds18)}
        />
        <Stat
          label={dict.player.averageDifferential}
          value={formatNumber(stats.averageDifferential)}
          note={stats.ratedRounds ? dict.player.averageDifferentialNote(stats.ratedRounds) : undefined}
        />
      </dl>

      <h2 className="mt-12 text-xl font-semibold">{dict.player.results}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 text-left text-foreground/60 dark:border-white/10">
            <tr>
              <th className="py-2 pr-4 font-medium">{dict.table.tournament}</th>
              <th className="whitespace-nowrap py-2 pr-4 text-right font-medium">{dict.table.pos}</th>
              <th className="whitespace-nowrap py-2 pr-4 text-right font-medium">{dict.table.percentile}</th>
              <th className="py-2 pr-4 font-medium">{dict.table.rounds}</th>
              <th className="whitespace-nowrap py-2 pr-4 text-right font-medium">{dict.table.total}</th>
              <th className="whitespace-nowrap py-2 text-right font-medium">{dict.table.toPar}</th>
            </tr>
          </thead>
          <tbody>
            {history.map(({ result, tournament, course, rounds }) => (
              <tr
                key={result.id}
                className="border-b border-black/5 align-top dark:border-white/5"
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/${lang}/tournaments/${tournament.id}`}
                    className="font-medium hover:underline"
                  >
                    {localizedName(lang, tournament).primary}
                  </Link>
                  <div className="text-xs text-foreground/60">
                    {formatDate(lang, tournament.start_date)}
                    {course && ` · ${localizedName(lang, course).primary}`}
                  </div>
                </td>
                <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums">
                  {formatPosition(result)}
                  {tournament.field_size && (
                    <span className="text-foreground/50"> / {tournament.field_size}</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">
                  {formatNumber(result.rank_percentile, 0)}
                </td>
                <td className="py-3 pr-4">
                  <ul className="space-y-0.5 text-xs tabular-nums">
                    {rounds.map((r) => (
                      <li key={r.id}>
                        <span className="font-medium">
                          R{r.round_number}: {r.score ?? "—"}
                        </span>
                        {r.holes !== 18 && <span> ({r.holes})</span>}
                        <span className="text-foreground/60">
                          {r.tee?.course_rating != null &&
                            ` · CR ${r.tee.course_rating} / ${r.tee.slope_rating ?? "—"}`}
                          {r.score_differential != null &&
                            ` · ${dict.table.differential} ${r.score_differential.toFixed(1)}`}
                          {r.temperature_c != null && ` · ${r.temperature_c}°C`}
                          {(lang === "en" ? r.weather_en : r.weather) &&
                            ` · ${lang === "en" ? r.weather_en : r.weather}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">{result.total_score ?? "—"}</td>
                <td className="py-3 text-right tabular-nums">{formatToPar(result.to_par)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-xs text-foreground/50">{dict.player.nameNote}</p>
    </div>
  );
}
