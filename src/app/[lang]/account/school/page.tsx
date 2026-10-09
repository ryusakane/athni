import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountApp } from "@/components/account/account-app";
import { getAccountDictionary } from "@/i18n/account";
import { hasLocale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/account/school">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: getAccountDictionary(lang).account.views.school, robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[lang]/account/school">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <AccountApp lang={lang} view="school" />;
}
