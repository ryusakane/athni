import { hasLocale, locales } from "@/i18n/config";
import { playerRows } from "@/lib/golf/player-rows";

// A static JSON file per language. Keeping the rows out of the page HTML keeps the players page
// light however many players there are.
export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/players/rows.json">) {
  const { lang } = await params;
  if (!hasLocale(lang)) return new Response(null, { status: 404 });
  return Response.json(await playerRows(lang));
}
