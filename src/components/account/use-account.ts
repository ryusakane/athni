"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { authEnabled, getSupabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/account-types";

export type AccountState =
  | { status: "disabled" | "loading" | "signedOut" }
  | { status: "signedIn"; session: Session; profile: Profile | null };

// The signed-in user and their profile row, kept in sync with Supabase auth events.
export function useAccount() {
  const [state, setState] = useState<AccountState>({
    status: authEnabled ? "loading" : "disabled",
  });

  const load = useCallback(async (session: Session | null) => {
    if (!session) {
      setState({ status: "signedOut" });
      return;
    }
    const { data } = await getSupabase()
      .from("profiles")
      .select("id, role, display_name, locale")
      .eq("id", session.user.id)
      .maybeSingle();
    setState({ status: "signedIn", session, profile: data as Profile | null });
  }, []);

  useEffect(() => {
    if (!authEnabled) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer: calling Supabase inside this callback can deadlock the auth lock.
      if (event !== "INITIAL_SESSION") setTimeout(() => load(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  return state;
}
