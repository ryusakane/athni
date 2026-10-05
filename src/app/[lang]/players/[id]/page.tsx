import type { Metadata } from "next";
import { WorkerSlot } from "@/components/worker-slot";
import { SHELL_ID, shellMetadata } from "@/lib/worker-pages";

// Shell only: the Worker (worker/index.tsx) serves /<lang>/players/<id>/ by filling this page's slot
// with data from Supabase.
export function generateStaticParams() {
  return [{ id: SHELL_ID }];
}

export const metadata: Metadata = shellMetadata;

export default function Shell() {
  return <WorkerSlot />;
}
