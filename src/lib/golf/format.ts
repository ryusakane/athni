import type { Locale } from "@/i18n/config";
import type { TournamentResult } from "./types";

export function formatPosition(result: Pick<TournamentResult, "status" | "position" | "tied">) {
  if (result.status !== "finished") return result.status.toUpperCase();
  if (result.position == null) return "—";
  return `${result.tied ? "T" : ""}${result.position}`;
}

export function formatToPar(toPar: number | null) {
  if (toPar == null) return "—";
  if (toPar === 0) return "E";
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}

export function formatNumber(value: number | null | undefined, digits = 1) {
  return value == null ? "—" : value.toFixed(digits);
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function formatDateRange(lang: Locale, start: string, end: string | null) {
  const format = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (!end || end === start) return format.format(parseDate(start));
  return format.formatRange(parseDate(start), parseDate(end));
}

export function formatDate(lang: Locale, value: string) {
  return formatDateRange(lang, value, null);
}

/** Primary name in the page language, plus the other language as a secondary label. */
export function localizedName(
  lang: Locale,
  item: { name_en: string | null; name_ja: string },
) {
  const en = item.name_en || item.name_ja;
  const primary = lang === "en" ? en : item.name_ja;
  const secondary = lang === "en" ? item.name_ja : en;
  return { primary, secondary: secondary === primary ? null : secondary };
}
