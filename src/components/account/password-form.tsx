"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getSupabase } from "@/lib/supabase/client";
import { Shell } from "./signup-form";
import { buttonClass, Field, Notice, PasswordInput } from "./ui";
import { useAccount } from "./use-account";

// Landing page for the password reset email; the link signs the user in first.
export function PasswordForm({ lang }: { lang: Locale }) {
  const t = getAccountDictionary(lang);
  const account = useAccount();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  if (account.status === "disabled") {
    return (
      <Shell title={t.newPassword.title}>
        <Notice>{t.notConfigured}</Notice>
      </Shell>
    );
  }
  if (account.status === "loading") {
    return <Shell title={t.newPassword.title}>{t.loading}</Shell>;
  }
  if (account.status === "signedOut") {
    return (
      <Shell title={t.newPassword.title}>
        <Notice>
          {t.account.needLogin}{" "}
          <Link href={`/${lang}/login/`} className="underline">
            {t.nav.login}
          </Link>
        </Notice>
      </Shell>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== form.get("password_confirm")) {
      setMessage({ tone: "error", text: t.passwordMismatch });
      return;
    }
    setPending(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setPending(false);
    setMessage(
      error
        ? { tone: "error", text: error.message || t.errorGeneric }
        : { tone: "success", text: t.newPassword.done },
    );
  }

  return (
    <Shell title={t.newPassword.title}>
      <form onSubmit={onSubmit} className="max-w-md space-y-4">
        <Field label={t.password} hint={t.passwordHint}>
          <PasswordInput
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
          />
        </Field>
        <Field label={t.passwordConfirm}>
          <PasswordInput
            name="password_confirm"
            required
            minLength={8}
            autoComplete="new-password"
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
          />
        </Field>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <button type="submit" disabled={pending} className={buttonClass}>
          {t.newPassword.submit}
        </button>
      </form>
      {message?.tone === "success" && (
        <Link href={`/${lang}/account/`} className="mt-6 inline-block text-sm underline">
          {t.account.title}
        </Link>
      )}
    </Shell>
  );
}
