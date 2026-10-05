import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PasswordForm } from "@/components/account/password-form";
import { getAccountDictionary } from "@/i18n/account";
import { hasLocale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/account/password">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getAccountDictionary(lang).newPassword.title, robots: { index: false } };
}

export default async function PasswordPage({ params }: PageProps<"/[lang]/account/password">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <PasswordForm lang={lang} />;
}
