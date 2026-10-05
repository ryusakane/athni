import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Stat } from "@/components/golf/stat";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { CLASS_YEARS, collegeSlugs, getCollege, rosterSummary } from "@/lib/colleges/queries";
import type { Program } from "@/lib/colleges/types";
import { formatDate } from "@/lib/golf/format";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await collegeSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/colleges/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) return {};
  const college = await getCollege(slug);
  return college ? { title: lang === "ja" && college.name_ja ? college.name_ja : college.name_en } : {};
}

const th = "py-2 pr-4 font-medium";
const thNum = `${th} text-right`;
const td = "py-2 pr-4";
const link = "underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground";

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={link} rel="noopener" target="_blank">
      {children}
    </a>
  );
}

const socials = [
  ["instagram_url", "Instagram"],
  ["x_url", "X"],
  ["facebook_url", "Facebook"],
  ["tiktok_url", "TikTok"],
  ["youtube_url", "YouTube"],
] as const;

export default async function CollegePage({ params }: PageProps<"/[lang]/colleges/[slug]">) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const college = await getCollege(slug);
  if (!college) notFound();
  const dict = getDictionary(lang);
  const t = dict.college;

  const name = lang === "ja" && college.name_ja ? college.name_ja : college.name_en;
  const place = [college.city, college.state].filter(Boolean).join(", ");
  const collected = college.programs
    .map((p) => p.collected_at)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
      <p className="mt-1 text-foreground/60">
        {[name !== college.name_en && college.name_en, college.nickname, college.division, college.conference, place]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {college.website_url && <ExternalLink href={college.website_url}>{t.website}</ExternalLink>}
        {college.athletics_url && <ExternalLink href={college.athletics_url}>{t.athletics}</ExternalLink>}
      </div>

      {college.programs.map((program) => (
        <ProgramSection key={program.gender} lang={lang} program={program} />
      ))}

      {collected && <p className="mt-10 text-xs text-foreground/50">{t.source(formatDate(lang, collected))}</p>}
    </div>
  );
}

function ProgramSection({ lang, program }: { lang: "en" | "ja"; program: Program }) {
  const dict = getDictionary(lang);
  const t = dict.college;
  const summary = rosterSummary(program);
  const links = [
    [program.golf_url, t.golfPage],
    [program.roster_url, t.rosterPage],
    [program.coaches_url, t.coachesPage],
  ] as const;
  const rankings = [...program.rankings].sort((a, b) => b.as_of.localeCompare(a.as_of));
  const alumniYears = program.alumni_pros.some((a) => a.final_college_year != null);

  return (
    <section className="mt-12 border-t border-black/10 pt-8 dark:border-white/10">
      <h2 className="text-2xl font-semibold">{t.program[program.gender]}</h2>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {links.map(([href, label]) => href && <ExternalLink key={label} href={href}>{label}</ExternalLink>)}
        {socials.map(([key, label]) => {
          const href = program[key];
          return href && <ExternalLink key={key} href={href}>{label}</ExternalLink>;
        })}
      </div>

      {program.roster.length === 0 && program.coaches.length === 0 && (
        <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          {t.notCollected}
        </p>
      )}

      {rankings.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold">{t.rankings}</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {rankings.map((r) => (
              <li key={`${r.source}|${r.as_of}`}>
                <span className="mr-2 text-lg font-semibold tabular-nums">#{r.rank}</span>
                {r.source_url ? <ExternalLink href={r.source_url}>{r.source}</ExternalLink> : r.source}
                <span className="ml-2 text-foreground/50">{formatDate(lang, r.as_of)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <h3 className="font-semibold">{t.coaches}</h3>
        {program.coaches.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/60">{t.noCoaches}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-black/10 text-left text-foreground/60 dark:border-white/10">
                <tr>
                  <th className={th}>{t.name}</th>
                  <th className={th}>{t.position}</th>
                  <th className={th}>{t.email}</th>
                  <th className={th}>{t.phone}</th>
                </tr>
              </thead>
              <tbody>
                {program.coaches.map((c) => (
                  <tr key={c.name} className="border-b border-black/5 dark:border-white/5">
                    <td className={`${td} font-medium`}>{c.name}</td>
                    <td className={`${td} text-foreground/70`}>{c.title ?? "—"}</td>
                    <td className={td}>
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className={link}>
                          {c.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {c.phone ? (
                        <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className={link}>
                          {c.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8">
        <h3 className="font-semibold">{t.roster(program.roster_season)}</h3>
        {program.roster.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/60">{t.noRoster}</p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-8">
              <Stat label={t.total} value={summary.total} />
              {CLASS_YEARS.map((c) => (
                <Stat key={c} label={t.classes[c]} value={summary.byClass[c]} />
              ))}
              <Stat label={t.international} value={summary.international} />
              <Stat label={t.japanese} value={summary.japanese.length} />
            </dl>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-black/10 text-left text-foreground/60 dark:border-white/10">
                  <tr>
                    <th className={th}>{t.player}</th>
                    <th className={th}>{t.class}</th>
                    <th className={th}>{t.hometown}</th>
                    <th className={th}>{t.previousSchool}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...program.roster]
                    .sort(
                      (a, b) =>
                        CLASS_YEARS.indexOf(a.class_year ?? "GR") - CLASS_YEARS.indexOf(b.class_year ?? "GR") ||
                        a.name.localeCompare(b.name, "en"),
                    )
                    .map((p) => (
                      <tr
                        key={p.name}
                        className={`border-b border-black/5 dark:border-white/5 ${p.country === "JP" ? "bg-red-500/5" : ""}`}
                      >
                        <td className={`${td} font-medium`}>{p.name}</td>
                        <td className={td}>
                          {p.class_year ? t.classes[p.class_year] : "—"}
                          {p.redshirt && " (RS)"}
                        </td>
                        <td className={`${td} text-foreground/70`}>{p.hometown ?? "—"}</td>
                        <td className={`${td} text-foreground/70`}>{p.previous_school ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="mt-8">
        <h3 className="font-semibold">{t.alumni}</h3>
        {program.alumni_pros.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/60">{t.noAlumni}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-black/10 text-left text-foreground/60 dark:border-white/10">
                <tr>
                  <th className={th}>{t.name}</th>
                  <th className={th}>{t.tour}</th>
                  {alumniYears && <th className={thNum}>{t.lastYear}</th>}
                </tr>
              </thead>
              <tbody>
                {program.alumni_pros.map((a) => (
                  <tr key={a.name} className="border-b border-black/5 dark:border-white/5">
                    <td className={`${td} font-medium`}>
                      {a.source_url ? <ExternalLink href={a.source_url}>{a.name}</ExternalLink> : a.name}
                    </td>
                    <td className={`${td} text-foreground/70`}>{a.tours.join(", ") || "—"}</td>
                    {alumniYears && (
                      <td className={`${td} text-right tabular-nums`}>{a.final_college_year ?? "—"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
