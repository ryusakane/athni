// Detail pages (one per player or tournament) are rendered on request by the Worker in worker/
// rather than exported as static files, which keeps a deploy under Cloudflare's 20,000-file cap.
// The static export builds one shell page per section and language at /<lang>/<section>/_/,
// with the site header and footer and an empty slot; the Worker fills the slot with the page.

export const SHELL_ID = "_";

/** Attribute on the element the Worker writes the rendered page into. */
export const SLOT_ATTRIBUTE = "data-worker-slot";

export const workerSections = ["players", "tournaments"] as const;
export type WorkerSection = (typeof workerSections)[number];

/**
 * The Worker writes each page's title, description, canonical and hreflang links into the head.
 * The shell must not render its own: React re-renders metadata when it hydrates, which would
 * replace the Worker's. (The shell URLs themselves get noindex from public/_headers.)
 */
export const shellMetadata = { title: null, description: null, alternates: null };
