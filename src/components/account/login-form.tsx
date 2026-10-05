"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { authEnabled, getSupabase } from "@/lib/supabase/client";
import { Shell } from "./signup-form";
import { buttonClass, Field, Input, Notice } from "./ui";

export function LoginForm({ lang }: { lang: Locale }) {
  const t = getAccountDictionary(lang);
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  if (!authEnabled) {
    return (
      <Shell title={t.login.title}>
        <Notice>{t.notConfigured}</Notice>
      </Shell>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    setPending(true);
    setMessage(null);
    const supabase = getSupabase();
    if (mode === "reset") {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/${lang}/account/password/`,
      });
      setPending(false);
      // Same message either way, so the form doesn't reveal which emails have accounts.
      setMessage({ tone: "success", text: t.login.resetSent });
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (error) setMessage({ tone: "error", text: t.login.failed });
    else router.push(`/${lang}/account/`);
  }

  return (
    <Shell title={mode === "login" ? t.login.title : t.login.forgot}>
      <form onSubmit={onSubmit} className="max-w-md space-y-4">
        <Field label={t.email}>
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        {mode === "login" && (
          <Field label={t.password}>
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>
        )}
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={buttonClass}>
            {mode === "login" ? t.login.submit : t.login.sendReset}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "reset" : "login");
              setMessage(null);
            }}
            className="text-sm underline"
          >
            {mode === "login" ? t.login.forgot : t.login.backToLogin}
          </button>
        </div>
      </form>
      <p className="mt-8 text-sm text-foreground/70">
        {t.login.noAccount}{" "}
        <Link href={`/${lang}/signup/`} className="font-medium underline">
          {t.login.createAccount}
        </Link>
      </p>
    </Shell>
  );
}
