"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The site is a static export, so auth runs in the browser. The anon key is public by design;
// row level security in supabase/migrations/0004_accounts.sql decides what each user can do.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const authEnabled = Boolean(url && key);

let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!url || !key) throw new Error("Supabase env vars are not set");
  // Implicit flow: the confirmation link carries the session in the URL hash, so it works
  // even when the email is opened on a different device from the one that signed up.
  client ??= createClient(url, key, {
    auth: { flowType: "implicit", persistSession: true, detectSessionInUrl: true },
  });
  return client;
}
