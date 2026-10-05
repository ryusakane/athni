import { Stat } from "@/components/golf/stat";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import {
  formatDate,
  formatDateRange,
  formatNumber,
  formatPosition,
  formatToPar,
  localizedName,
} from "@/lib/golf/format";
import type { TournamentDetail } from "@/lib/golf/views";

const th = "py-2 pr-4 font-medium";
const thNum = `${th} text-right`;
const td = "py-2 pr-4";
const tdNum = `${td} text-right tabular-nums`;

// Rendered to HTML by the Worker (worker/index.tsx) on each request and injected into the static
// shell page, so it uses plain links: it is never hydrated or routed by Next.js.
export function TournamentView({ lang, data }: { lang: Locale; data: TournamentDetail }) {
  const dict = getDictionary(lang);
  const { tournament, course, tees, leaderboard, roundNumbers, conditions } = data;
  const name = localizedName(lang, tournament);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{name.primary}</h1>
      {name.secondary && <p className="mt-1 text-foreground/60">{name.secondary}</p>}

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label={dict.tournament.dates}
          value={
            <span className="text-base">
              {formatDateRange(lang, tournament.start_date, tournament.end_date)}
            </span>
          }
        />
        <Stat
          label={dict.tournament.venue}
          value={<span className="text-base">{course ? localizedName(lang, course).primary : "—"}</span>}
        />
        <Stat label={dict.tournament.field} value={tournament.field_size ?? "—"} />
        <Stat label={dict.tournament.winningScore} value={tournament.winning_score ?? "—"} />
      </dl>

      {tees.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">{dict.tournament.tees}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="text-sm">
              <thead className="border-b border-black/10 text-left text-foreground/60 dark:border-white/10">
                <tr>
                  <th className={th}>{dict.tournament.tee}</th>
                  <th className={thNum}>{dict.tournament.par}</th>
                  <th className={thNum}>{dict.tournament.yards}</th>
                  <th className={thNum}>{dict.tournament.rating}</th>
                  <th className={thNum}>{dict.tournament.slope}</th>
                </tr>
              </thead>
              <tbody>
                {tees.map((tee) => (
                  <tr key={tee.id} className="border-b border-black/5 dark:border-white/5">
                    <td className={td}>
                      {tee.tee_name} ({dict.labels[tee.gender]})
                    </td>
                    <td className={tdNum}>{tee.par}</td>
                    <td className={tdNum}>{tee.yardage ?? "—"}</td>
                    <td className={tdNum}>{tee.course_rating ?? dict.tournament.notRated}</td>
                    <td className={tdNum}>{tee.slope_rating ?? dict.tournament.notRated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {conditions.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">{dict.tournament.conditions}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="text-sm">
              <thead className="border-b border-black/10 text-left text-foreground/60 dark:border-white/10">
                <tr>
                  <th className={th}>{dict.tournament.round}</th>
                  <th className={th}>{dict.tournament.date}</th>
                  <th className={thNum}>{dict.tournament.holes}</th>
                  <th className={th}>{dict.tournament.weather}</th>
                  <th className={thNum}>{dict.tournament.high}</th>
                  <th className={thNum}>{dict.tournament.wind}</th>
                  <th className={thNum}>{dict.tournament.rain}</th>
                  <th className={thNum}>{dict.tournament.fieldAverage}</th>
                </tr>
              </thead>
              <tbody>
                {conditions.map((c) => (
                  <tr key={c.roundNumber} className="border-b border-black/5 dark:border-white/5">
                    <td className={td}>R{c.roundNumber}</td>
                    <td className={td}>{c.playedOn ? formatDate(lang, c.playedOn) : "—"}</td>
                    <td className={tdNum}>{c.holes}</td>
                    <td className={td}>{(lang === "en" ? c.weatherEn : c.weather) ?? "—"}</td>
                    <td className={tdNum}>
                      {c.temperatureC != null ? `${c.temperatureC}°C` : "—"}
                    </td>
                    <td className={tdNum}>
                      {c.windSpeedMs != null ? `${c.windSpeedMs} m/s` : "—"}
                    </td>
                    <td className={tdNum}>
                      {c.precipitationMm != null ? `${c.precipitationMm} mm` : "—"}
                    </td>
                    <td className={tdNum}>{formatNumber(c.averageScore, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">{dict.tournament.leaderboard}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-black/10 text-left text-foreground/60 dark:border-white/10">
              <tr>
                <th className={th}>{dict.table.pos}</th>
                <th className={th}>{dict.table.player}</th>
                <th className={th}>{dict.table.school}</th>
                {roundNumbers.map((n) => (
                  <th key={n} className={thNum}>
                    R{n}
                  </th>
                ))}
                <th className={thNum}>{dict.table.total}</th>
                <th className={`${thNum} pr-0`}>{dict.table.toPar}</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map(({ result, player, school, rounds }) => (
                <tr key={result.id} className="border-b border-black/5 dark:border-white/5">
                  <td className={`${td} tabular-nums`}>{formatPosition(result)}</td>
                  <td className={td}>
                    <a href={`/${lang}/players/${player.id}/`} className="font-medium hover:underline">
                      {localizedName(lang, player).primary}
                    </a>
                  </td>
                  <td className={`${td} text-foreground/70`}>
                    {school ? localizedName(lang, school).primary : "—"}
                  </td>
                  {roundNumbers.map((n) => (
                    <td key={n} className={tdNum}>
                      {rounds.find((r) => r.round_number === n)?.score ?? ""}
                    </td>
                  ))}
                  <td className={`${tdNum} font-medium`}>{result.total_score ?? "—"}</td>
                  <td className={`${tdNum} pr-0`}>{formatToPar(result.to_par)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 space-y-1 text-xs text-foreground/50">
        {tournament.source_url && (
          <p>
            {dict.tournament.source}:{" "}
            <a href={tournament.source_url} className="underline" rel="noopener" target="_blank">
              {tournament.organizer ?? tournament.source_url}
            </a>
          </p>
        )}
        <p>{dict.player.nameNote}</p>
      </div>
    </div>
  );
}
