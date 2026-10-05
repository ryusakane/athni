import { renderToString } from "react-dom/server";
import { PlayerView } from "@/components/golf/player-view";
import { TournamentView } from "@/components/golf/tournament-view";
import { locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatDateRange, formatNumber, localizedName } from "@/lib/golf/format";
import { flattenEmbedded, supabaseGet, type SupabaseConfig } from "@/lib/golf/supabase";
import { buildIndexes, playerDetail, tournamentDetail } from "@/lib/golf/views";
import { SHELL_ID, SLOT_ATTRIBUTE, type WorkerSection } from "@/lib/worker-pages";

// Serves player and tournament detail pages, which have no static file (src/lib/worker-pages.ts).
// Everything else is a static asset that Cloudflare serves without running this Worker, except
// missing files, which come here and get the static 404 page.

type Env = {
  ASSETS: Fetcher;
  CF_VERSION_METADATA?: { id: string };
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
};

const origin = "https://athtouni.com";
const detailPath =
  /^\/(en|ja)\/(players|tournaments)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/?)$/;

// Browsers re-check after 5 minutes. The edge cache keeps a page for a day, but one older than
// 10 minutes is refreshed in the background after serving it, so readers never wait on Supabase
// for a page someone has opened before, and data changes still show within minutes.
const cacheControl = "public, max-age=300, s-maxage=86400";
const refreshAfterMs = 10 * 60 * 1000;
const renderedAt = "X-Rendered-At";

type Page = { title: string; description: string; html: string };

async function playerPage(db: SupabaseConfig, lang: Locale, id: string): Promise<Page | null> {
  // One round trip: the player with every result, tournament, course, round and tee embedded.
  const rows = await supabaseGet<object>(
    db,
    `players?id=eq.${id}&select=*,school:schools(*),tournament_results(*,` +
      `tournament:tournaments(*,course:courses(*)),rounds(*,tee:course_tees(*)))`,
  );
  const data = flattenEmbedded("players", rows);
  const detail = playerDetail(buildIndexes(data), id);
  if (!detail) return null;

  const dict = getDictionary(lang);
  const { player, school, stats } = detail;
  const name = localizedName(lang, player);
  return {
    title: name.primary,
    description: [
      name.secondary ? `${name.primary} (${name.secondary})` : name.primary,
      school && localizedName(lang, school).primary,
      player.graduation_year && `${dict.player.classOf} ${player.graduation_year}`,
      `${dict.player.events} ${stats.events}`,
      stats.scoringAverage != null &&
        `${dict.player.scoringAverage} ${formatNumber(stats.scoringAverage, 2)}`,
    ]
      .filter(Boolean)
      .join(" · "),
    html: renderToString(<PlayerView lang={lang} data={detail} />),
  };
}

async function tournamentPage(db: SupabaseConfig, lang: Locale, id: string): Promise<Page | null> {
  // One round trip: the tournament with its course and every result, player, school and round.
  const rows = await supabaseGet<object>(
    db,
    `tournaments?id=eq.${id}&select=*,course:courses(*),tournament_results(*,` +
      `player:players(*,school:schools(*)),rounds(*,tee:course_tees(*)))`,
  );
  const data = flattenEmbedded("tournaments", rows);
  const detail = tournamentDetail(buildIndexes(data), id);
  if (!detail) return null;

  const dict = getDictionary(lang);
  const { tournament, course } = detail;
  const name = localizedName(lang, tournament);
  return {
    title: name.primary,
    description: [
      name.secondary ? `${name.primary} (${name.secondary})` : name.primary,
      formatDateRange(lang, tournament.start_date, tournament.end_date),
      course && localizedName(lang, course).primary,
      tournament.field_size && `${dict.tournament.field} ${tournament.field_size}`,
    ]
      .filter(Boolean)
      .join(" · "),
    html: renderToString(<TournamentView lang={lang} data={detail} />),
  };
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function render(env: Env, request: Request, lang: Locale, section: WorkerSection, id: string) {
  const db = { url: env.SUPABASE_URL, key: env.SUPABASE_KEY };
  const [shell, page] = await Promise.all([
    env.ASSETS.fetch(new URL(`/${lang}/${section}/${SHELL_ID}/`, request.url)),
    section === "players" ? playerPage(db, lang, id) : tournamentPage(db, lang, id),
  ]);
  // Unknown id: the static 404 page, with a 404 status.
  if (!page) return env.ASSETS.fetch(request);

  const url = (l: string) => `${origin}/${l}/${section}/${id}/`;
  const shellLink = new RegExp(`/${section}/${SHELL_ID}/?$`);
  const rewritten = new HTMLRewriter()
    // The shell renders no per-page metadata (shellMetadata), so this is the only copy.
    .on("head", {
      element(el) {
        el.append(
          [
            `<title>${escapeHtml(page.title)} | AthNi</title>`,
            `<meta name="description" content="${escapeHtml(page.description)}"/>`,
            `<link rel="canonical" href="${url(lang)}"/>`,
            ...locales.map((l) => `<link rel="alternate" hreflang="${l}" href="${url(l)}"/>`),
          ].join(""),
          { html: true },
        );
      },
    })
    // The language switch is rendered for the shell's path; point it at this page.
    .on("a[href]", {
      element(el) {
        const href = el.getAttribute("href")!;
        if (shellLink.test(href)) el.setAttribute("href", href.replace(shellLink, `/${section}/${id}/`));
      },
    })
    .on(`[${SLOT_ATTRIBUTE}]`, {
      element(el) {
        el.setInnerContent(page.html, { html: true });
      },
    })
    .transform(shell);

  return new Response(rewritten.body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cacheControl,
      [renderedAt]: String(Date.now()),
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const match = detailPath.exec(url.pathname);
    if (!match || (request.method !== "GET" && request.method !== "HEAD")) {
      return env.ASSETS.fetch(request);
    }
    const [, lang, section, id, slash] = match as unknown as [string, Locale, WorkerSection, string, string];
    if (!slash) return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 308);

    // Keyed by deploy too: a page cached before a deploy links the old build's CSS files.
    const cacheKey = new Request(`${url.origin}${url.pathname}?v=${env.CF_VERSION_METADATA?.id ?? ""}`);
    const refresh = async () => {
      const response = await render(env, request, lang, section, id);
      if (response.status === 200) ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
      return response;
    };

    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const age = Date.now() - Number(cached.headers.get(renderedAt));
      if (!(age < refreshAfterMs)) ctx.waitUntil(refresh().catch((e) => console.error(e)));
      return cached;
    }
    try {
      return await refresh();
    } catch (error) {
      console.error(error);
      return new Response("Temporarily unavailable. Please try again shortly.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "30" },
      });
    }
  },
} satisfies ExportedHandler<Env>;
