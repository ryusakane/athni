import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { playerIds, tournamentIds } from "@/lib/golf/queries";

const origin = "https://athtouni.com";

// Lists every page in both languages, including the detail pages the Worker renders on request,
// which have no static file for crawlers to find otherwise.
export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = [
    "",
    "/players",
    "/tournaments",
    "/about",
    "/contact",
    ...(await playerIds()).map((id) => `/players/${id}`),
    ...(await tournamentIds()).map((id) => `/tournaments/${id}`),
  ];
  return paths.flatMap((path) => {
    const languages = Object.fromEntries(locales.map((l) => [l, `${origin}/${l}${path}/`]));
    return locales.map((lang) => ({ url: languages[lang], alternates: { languages } }));
  });
}
