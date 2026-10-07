"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getSupabase } from "@/lib/supabase/client";
import { Field, Input, secondaryButtonClass } from "./ui";
import { useAccount } from "./use-account";

// On a public player page: "Save player" for verified coaches, "This is me" for students.
// Renders nothing for visitors, so the static page looks the same to search engines.
export function PlayerActions({ lang, playerId }: { lang: Locale; playerId: string }) {
  const t = getAccountDictionary(lang).player;
  const account = useAccount();
  const role = account.status === "signedIn" ? account.profile?.role : undefined;
  const userId = account.status === "signedIn" ? account.session.user.id : undefined;
  const [state, setState] = useState<{ canSave: boolean; saved: boolean; claimed: boolean } | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!userId || (role !== "coach" && role !== "student")) return;
    const supabase = getSupabase();
    (async () => {
      if (role === "coach") {
        const [coach, saved] = await Promise.all([
          supabase.from("coach_profiles").select("verification_status").eq("user_id", userId).single(),
          supabase.from("coach_saved_players").select("player_id").eq("coach_id", userId).eq("player_id", playerId),
        ]);
        setState({
          canSave: coach.data?.verification_status === "verified",
          saved: (saved.data ?? []).length > 0,
          claimed: false,
        });
      } else {
        const { data } = await supabase
          .from("player_claims")
          .select("id")
          .eq("student_id", userId)
          .eq("player_id", playerId);
        setState({ canSave: false, saved: false, claimed: (data ?? []).length > 0 });
      }
    })();
  }, [role, userId, playerId]);

  if (!state || !userId) return null;

  async function toggleSave() {
    const supabase = getSupabase();
    if (state!.saved) {
      await supabase.from("coach_saved_players").delete().eq("coach_id", userId).eq("player_id", playerId);
    } else {
      await supabase.from("coach_saved_players").insert({ coach_id: userId, player_id: playerId });
    }
    setState({ ...state!, saved: !state!.saved });
  }

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const evidence = String(new FormData(event.currentTarget).get("evidence_url") ?? "").trim();
    const { error } = await getSupabase()
      .from("player_claims")
      .insert({ student_id: userId, player_id: playerId, evidence_url: evidence || null });
    if (!error) {
      setClaiming(false);
      setState({ ...state!, claimed: true });
    }
  }

  if (role === "coach" && state.canSave) {
    return (
      <button type="button" onClick={toggleSave} className={`${secondaryButtonClass} mt-4`}>
        {state.saved ? t.unsave : t.save}
      </button>
    );
  }
  if (role === "student" && claiming) {
    // A link to results with the student's name helps staff confirm the claim.
    return (
      <form onSubmit={claim} className="mt-4 max-w-md space-y-3">
        <Field label={t.evidence} hint={t.evidenceHint}>
          <Input name="evidence_url" type="url" />
        </Field>
        <button type="submit" className={secondaryButtonClass}>
          {t.sendClaim}
        </button>
      </form>
    );
  }
  if (role === "student") {
    return (
      <button
        type="button"
        onClick={() => setClaiming(true)}
        disabled={state.claimed}
        className={`${secondaryButtonClass} mt-4`}
      >
        {state.claimed ? t.claimed : t.claim}
      </button>
    );
  }
  return null;
}
