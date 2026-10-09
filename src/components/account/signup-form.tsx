"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { authEnabled, getSupabase } from "@/lib/supabase/client";
import { AddressFields } from "./address-fields";
import { buttonClass, DateSelect, Field, Input, Notice, KanaInput, PasswordInput, YearSelect } from "./ui";

type SignupRole = "student" | "parent" | "coach";
const signupRoles: SignupRole[] = ["student", "parent", "coach"];

const isSignupRole = (value: string | null): value is SignupRole =>
  signupRoles.includes(value as SignupRole);

export function SignupForm({ lang }: { lang: Locale }) {
  const t = getAccountDictionary(lang);
  const router = useRouter();
  const [role, setRole] = useState<SignupRole | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Parents arrive from the link on their child's account page: ?role=parent&code=XXXX.
  // Read once on mount; useSearchParams would need a Suspense boundary in a static export.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("role");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL
    if (isSignupRole(fromUrl)) setRole(fromUrl);
    setInviteCode(params.get("code") ?? "");
  }, []);

  if (!authEnabled) {
    return (
      <Shell title={t.signup.title}>
        <Notice>{t.notConfigured}</Notice>
      </Shell>
    );
  }

  if (sentTo) {
    return (
      <Shell title={t.signup.title}>
        <Notice tone="success">{t.signup.checkEmail(sentTo)}</Notice>
      </Shell>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const email = value("email");
    // Japanese order is family name first; English is given name first.
    const family = value("family_name");
    const given = value("given_name");
    const fullName = lang === "ja" ? `${family} ${given}` : `${given} ${family}`;
    const fullKana = [value("family_kana"), value("given_kana")].filter(Boolean).join(" ");
    if (form.get("password") !== form.get("password_confirm")) {
      setError(t.passwordMismatch);
      return;
    }
    setPending(true);
    setError(null);
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password: String(form.get("password") ?? ""),
      options: {
        emailRedirectTo: `${window.location.origin}/${lang}/account/`,
        // Read by handle_new_user() in 0004_accounts.sql to create the role's rows.
        data: {
          role,
          display_name: fullName,
          // Kept apart as well, in the auth user's metadata, in case the parts are needed later.
          family_name: family,
          given_name: given,
          family_kana: value("family_kana"),
          given_kana: value("given_kana"),
          name_kana: fullKana,
          locale: lang,
          ...(role === "student" && (lang === "ja" ? { name_ja: fullName } : { name_en: fullName })),
          ...(role === "student" && {
            birth_date: value("birth_date"),
            graduation_year: value("graduation_year"),
            // Address and high school: used to find the student's results after login.
            country: value("country"),
            prefecture: value("prefecture"),
            postal_code: value("postal_code"),
            address_line: value("address_line"),
            school_name: value("school_name"),
          }),
          ...(role === "coach" && { college_name: value("college_name"), title: value("title") }),
          ...(role === "parent" && { invite_code: value("invite_code") }),
        },
      },
    });
    setPending(false);
    if (error) {
      setError(error.message || t.errorGeneric);
      return;
    }
    // With email confirmation off, Supabase signs the user in straight away.
    if (data.session) router.push(`/${lang}/account/`);
    else setSentTo(email);
  }

  const thisYear = new Date().getFullYear();

  return (
    <Shell title={t.signup.title}>
      <p className="text-sm font-medium">{t.signup.chooseRole}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {signupRoles.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            aria-pressed={role === r}
            className={`rounded-lg border p-4 text-left transition ${
              role === r
                ? "border-foreground bg-foreground/5"
                : "border-black/10 hover:border-foreground/40 dark:border-white/15"
            }`}
          >
            <span className="block font-semibold">{t.roles[r].title}</span>
            <span className="mt-1 block text-xs text-foreground/60">{t.roles[r].body}</span>
          </button>
        ))}
      </div>

      {role && (
        <form onSubmit={onSubmit} className="mt-8 max-w-md space-y-4">
          {lang === "ja" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.familyName}>
                  <Input name="family_name" required autoComplete="family-name" placeholder="山田" />
                </Field>
                <Field label={t.givenName}>
                  <Input name="given_name" required autoComplete="given-name" placeholder="太郎" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.familyKana}>
                  <KanaInput name="family_kana" required placeholder="ヤマダ" />
                </Field>
                <Field label={t.givenKana}>
                  <KanaInput name="given_kana" required placeholder="タロウ" />
                </Field>
              </div>
              <p className="-mt-2 text-xs text-foreground/60">{t.nameKanaHint}</p>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.givenName}>
                <Input name="given_name" required autoComplete="given-name" />
              </Field>
              <Field label={t.familyName}>
                <Input name="family_name" required autoComplete="family-name" />
              </Field>
            </div>
          )}
          <Field label={t.email} hint={role === "coach" ? t.signup.eduNote : undefined}>
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
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

          {role === "student" && (
            <>
              <Field label={t.signup.birthDate}>
                <DateSelect
                  name="birth_date"
                  required
                  fromYear={1950}
                  toYear={thisYear}
                  labels={{ year: t.year, month: t.month, day: t.day }}
                />
              </Field>
              <Field label={t.signup.graduationYear}>
                <YearSelect
                  name="graduation_year"
                  required
                  fromYear={2000}
                  toYear={thisYear + 6}
                  defaultValue={String(thisYear + 1)}
                  placeholder={t.year}
                />
              </Field>
              <Field label={t.identity.school}>
                <Input name="school_name" required autoComplete="organization" />
              </Field>
              <AddressFields lang={lang} required />
            </>
          )}

          {role === "coach" && (
            <>
              <Field label={t.signup.collegeName}>
                <Input name="college_name" required autoComplete="organization" />
              </Field>
              <Field label={t.signup.coachTitle}>
                <Input name="title" autoComplete="organization-title" />
              </Field>
            </>
          )}

          {role === "parent" && (
            <Field label={t.signup.inviteCode} hint={t.signup.inviteNote}>
              <Input
                name="invite_code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="uppercase"
                autoComplete="off"
              />
            </Field>
          )}

          <label className="flex gap-2 text-sm">
            <input type="checkbox" required className="mt-1" />
            <span>{t.signup.agree}</span>
          </label>

          {error && <Notice tone="error">{error}</Notice>}
          <button type="submit" disabled={pending} className={buttonClass}>
            {t.signup.submit}
          </button>
        </form>
      )}

      <p className="mt-8 text-sm text-foreground/70">
        {t.signup.haveAccount}{" "}
        <Link href={`/${lang}/login/`} className="font-medium underline">
          {t.nav.login}
        </Link>
      </p>
    </Shell>
  );
}

export function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}
