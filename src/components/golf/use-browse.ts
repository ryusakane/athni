"use client";

import { useEffect, useState } from "react";
import type { Dataset } from "@/lib/golf/types";
import { indexDataset, type Indexes } from "@/lib/golf/views";

export type Browse<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "notFound" }
  | { status: "ready"; data: T };

/** Reads ?id= from the URL, loads that record's rows and builds the page data in the browser. */
export function useBrowse<T>(
  load: (id: string) => Promise<Dataset>,
  view: (ix: Indexes, id: string) => T | null,
): Browse<T> {
  const [state, setState] = useState<Browse<T>>({ status: "loading" });
  useEffect(() => {
    // Read on mount; useSearchParams would need a Suspense boundary in a static export.
    const id = new URLSearchParams(window.location.search).get("id");
    let live = true;
    (id ? load(id) : Promise.resolve(null))
      .then((rows) => {
        const data = id && rows ? view(indexDataset(rows), id) : null;
        if (live) setState(data ? { status: "ready", data } : { status: "notFound" });
      })
      .catch(() => live && setState({ status: "error" }));
    return () => {
      live = false;
    };
  }, [load, view]);
  return state;
}
