"use client";

import { useState, useSyncExternalStore } from "react";
import type { ProgramGender } from "@/lib/colleges/types";

const subscribe = () => () => {};
const fromUrl = (): ProgramGender | null => {
  const g = new URLSearchParams(window.location.search).get("gender");
  return g === "women" ? "female" : g === "men" ? "male" : null;
};

/**
 * Shows one program at a time when the college has both: the one picked on the list
 * (?gender=men|women), switchable here. Without a choice (or without JS) both are shown,
 * since the page is static and prerendered with both.
 */
export function ProgramOrder({
  genders,
  labels,
  children,
}: {
  genders: ProgramGender[];
  labels: Record<ProgramGender, string>;
  children: React.ReactNode;
}) {
  const initial = useSyncExternalStore(subscribe, fromUrl, () => null);
  const [picked, setPicked] = useState<ProgramGender | null>(null);
  const both = genders.includes("male") && genders.includes("female");
  const shown = both ? (picked ?? initial) : null;

  const pick = (g: ProgramGender) => {
    setPicked(g);
    const url = new URL(window.location.href);
    url.searchParams.set("gender", g === "female" ? "women" : "men");
    window.history.replaceState(null, "", url);
  };

  return (
    <>
      {both && (
        <div className="mt-8 inline-flex rounded-full border border-black/15 p-1 text-sm dark:border-white/20">
          {(["male", "female"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => pick(g)}
              className={`rounded-full px-4 py-1.5 ${shown === g ? "bg-foreground text-background" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
            >
              {labels[g]}
            </button>
          ))}
        </div>
      )}
      <div
        className={
          shown === "female"
            ? "[&>[data-gender=male]]:hidden"
            : shown === "male"
              ? "[&>[data-gender=female]]:hidden"
              : undefined
        }
      >
        {children}
      </div>
    </>
  );
}
