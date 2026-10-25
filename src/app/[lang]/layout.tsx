import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return {
    metadataBase: new URL("https://athtouni.com"),
    title: { default: "AthNi", template: "%s | AthNi" },
    description: getDictionary(lang).meta.description,
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon.svg", type: "image/svg+xml" },
      ],
      apple: "/apple-touch-icon.png",
    },
    alternates: { languages: { en: "/en", ja: "/ja" } },
  };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* One address for the site: a login is saved per host, so www and the bare domain
            would otherwise each have their own (logged in on one, logged out on the other). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if(location.hostname==="www.athtouni.com")location.replace("https://athtouni.com"+location.pathname+location.search+location.hash)`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteHeader lang={lang} dict={dict} />
        <main className="flex-1">{children}</main>
        <SiteFooter lang={lang} />
      </body>
    </html>
  );
}
