"use client";

import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { authEnabled, getSupabase, hasStoredSession } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/account-types";

export type AccountState =
  | { status: "disabled" | "loading" | "signedOut" }
  | { status: "signedIn"; session: Session; profile: Profile | null };

// One copy of the signed-in user for the whole tab, so the header, player pages and the
// account screens agree and moving between pages doesn't re-check the login each time.
let state: AccountState = { status: authEnabled ? "loading" : "disabled" };
const listeners = new Set<() => void>();
let started = false;

function set(next: AccountState) {
  state = next;
  listeners.forEach((l) => l());
}

async function load(session: Session | null) {
  if (!session) {
    set({ status: "signedOut" });
    return;
  }
  // Keep the profile while the same user's token refreshes.
  const prev = state;
  if (prev.status === "signedIn" && prev.session.user.id === session.user.id && prev.profile) {
    set({ status: "signedIn", session, profile: prev.profile });
    return;
  }
  const { data } = await getSupabase()
    .from("profiles")
    .select("id, role, display_name, locale")
    .eq("id", session.user.id)
    .maybeSingle();
  set({ status: "signedIn", session, profile: data as Profile | null });
}

function start() {
  if (started || !authEnabled) return;
  started = true;
  const supabase = getSupabase();
  supabase.auth.getSession().then(({ data }) => load(data.session));
  supabase.auth.onAuthStateChange((event, session) => {
    // Defer: calling Supabase inside this callback can deadlock the auth lock.
    if (event !== "INITIAL_SESSION") setTimeout(() => load(session), 0);
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverState: AccountState = { status: authEnabled ? "loading" : "disabled" };

/** The signed-in user and their profile row, kept in sync with Supabase auth events. */
export function useAccount() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

/**
 * True when this browser holds a login, before Supabase has confirmed it. Lets the header
 * show "My account" straight away on every page instead of blinking empty after each load.
 */
export function useLikelySignedIn() {
  return useSyncExternalStore(
    () => () => {},
    hasStoredSession,
    () => false,
  );
}
