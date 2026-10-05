import { SLOT_ATTRIBUTE } from "@/lib/worker-pages";

// Empty in the static shell; the Worker writes the page into it (src/lib/worker-pages.ts).
// React does not compare dangerouslySetInnerHTML when it hydrates, so it keeps the injected markup.
export function WorkerSlot() {
  return <div {...{ [SLOT_ATTRIBUTE]: "" }} dangerouslySetInnerHTML={{ __html: "" }} />;
}
