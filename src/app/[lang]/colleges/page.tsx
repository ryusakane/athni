import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollegeTable, type CollegeRow } from "@/components/colleges/college-table";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { focusPlayersSince2016, latestRanking, listColleges, rankingSeason, rosterSummary } from "@/lib/colleges/queries";
import type { College, ProgramGender, Ranking } from "@/lib/colleges/types";
import { formatDate } from "@/lib/golf/format";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/colleges">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getDictionary(lang).colleges.title };
}

function programCell(college: College, gender: ProgramGender) {
  const program = college.programs.find((p) => p.gender === gender);
  if (!program) return null;
  const roster = program.roster.length ? rosterSummary(program) : null;
  const ranking = latestRanking(program);
  return {
    rank: ranking?.rank ?? null,
    season: ranking ? rankingSeason(ranking) : null,
    roster: roster?.total ?? null,
    japanese: roster?.japanese.length ?? 0,
    japaneseSince2016: focusPlayersSince2016(program),
    collected: program.roster.length > 0 || program.coaches.length > 0,
  };
}

export default async function CollegesPage({ params }: PageProps<"/[lang]/colleges">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const { colleges } = await listColleges();

  const rows: CollegeRow[] = colleges.map((c) => ({
    slug: c.slug,
    name: lang === "ja" && c.name_ja ? c.name_ja : c.name_en,
    nickname: c.nickname,
    division: c.division,
    conference: c.conference,
    state: c.state,
    men: programCell(c, "male"),
    women: programCell(c, "female"),
  }));

  // One line per ranking table the list draws on, so readers know where the numbers come from.
  const rankingSources = new Map<string, Ranking>();
  for (const c of colleges) {
    for (const p of c.programs) {
      const r = latestRanking(p);
      if (r) rankingSources.set(`${r.source}|${r.as_of}`, r);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{dict.colleges.title}</h1>
      <p className="mt-3 max-w-2xl text-foreground/70">{dict.colleges.lead}</p>
      <div className="mt-8">
        <CollegeTable lang={lang} rows={rows} />
      </div>
      <div className="mt-8 space-y-1 text-xs text-foreground/50">
        {[...rankingSources.values()].map((r) => (
          <p key={`${r.source}|${r.as_of}`}>
            {r.source_url ? (
              <a href={r.source_url} className="underline" rel="noopener" target="_blank">
                {dict.colleges.rankingNote(r.source, rankingSeason(r), formatDate(lang, r.as_of))}
              </a>
            ) : (
              dict.colleges.rankingNote(r.source, rankingSeason(r), formatDate(lang, r.as_of))
            )}
          </p>
        ))}
      </div>
    </div>
  );
}
