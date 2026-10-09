import type { Locale } from "@/i18n/config";

// The student area is split into a home with four entries and one page for each.
export type AccountView = "home" | "roadmap" | "golf" | "school" | "settings";
export const subViews = ["roadmap", "golf", "school", "settings"] as const;

// Which page each section of the student area lives on (sections keep their anchor ids).
export const sectionView = {
  targets: "roadmap",
  golf: "golf",
  results: "golf",
  academics: "school",
  tests: "school",
  documents: "school",
  sharing: "settings",
  profile: "settings",
} as const satisfies Record<string, AccountView>;

export type SectionId = keyof typeof sectionView;

// A parent views a child's pages with ?student=<id>.
export function accountHref(lang: Locale, view: AccountView, studentId?: string, hash?: string) {
  const path = view === "home" ? `/${lang}/account/` : `/${lang}/account/${view}/`;
  return `${path}${studentId ? `?student=${studentId}` : ""}${hash ? `#${hash}` : ""}`;
}
