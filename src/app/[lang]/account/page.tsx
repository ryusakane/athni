import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountApp } from "@/components/account/account-app";
import { getAccountDictionary } from "@/i18n/account";
import { hasLocale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/account">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getAccountDictionary(lang).account.title, robots: { index: false } };
}

export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <AccountApp lang={lang} />;
}
