import type { Locale } from "./config";

const en = {
  meta: {
    description:
      "Profiles, tournament results, and course data for Japanese high school golfers, built for US college recruiting.",
  },
  nav: {
    players: "Players",
    tournaments: "Tournaments",
    about: "About",
    contact: "Contact",
  },
  home: {
    tagline:
      "Opening the door to US college athletics for every Japanese high school athlete.",
    lead: "Player profiles, tournament results, rankings, and scores with course rating and slope, presented in English for college coaches.",
    ctaPlayers: "Browse players",
    ctaTournaments: "View tournaments",
  },
  players: {
    title: "Players",
    empty: "Player profiles will appear here once the database is connected.",
  },
  tournaments: {
    title: "Tournaments & Results",
    empty:
      "Tournament results, rankings, scores, course rating/slope, and weather will appear here once the database is connected.",
  },
  about: {
    title: "About",
    body: "Athni collects tournament results for high school golfers across Japan and presents them in English with the context US college coaches need: course rating and slope, field strength, and playing conditions.",
  },
  contact: {
    title: "Contact",
    body: "A contact form will be added soon.",
  },
  footer: { language: "日本語" },
};

export type Dictionary = typeof en;

const ja: Dictionary = {
  meta: {
    description:
      "日本の高校生ゴルファーの選手データ、大会成績、コース情報をまとめ、アメリカ大学進学を支援するサービス",
  },
  nav: {
    players: "選手",
    tournaments: "大会・成績",
    about: "概要",
    contact: "お問い合わせ",
  },
  home: {
    tagline: "日本のすべての高校生アスリートに、アメリカ大学進学の門戸を。",
    lead: "選手プロフィール、大会成績、順位、スコアを、コースのレーティングやスロープと合わせて英語でも発信します。",
    ctaPlayers: "選手を探す",
    ctaTournaments: "大会・成績を見る",
  },
  players: {
    title: "選手",
    empty: "選手データはデータベース接続後に表示されます。",
  },
  tournaments: {
    title: "大会・成績",
    empty:
      "大会成績、順位、スコア、コースのレーティング・スロープ、天候はデータベース接続後に表示されます。",
  },
  about: {
    title: "概要",
    body: "Athni は全国の高校生ゴルファーの大会成績を集約し、コースのレーティングやスロープ、出場選手のレベル、当日のコンディションなど、アメリカの大学コーチが必要とする情報と合わせて英語で発信するサービスです。",
  },
  contact: {
    title: "お問い合わせ",
    body: "お問い合わせフォームは近日追加予定です。",
  },
  footer: { language: "English" },
};

const dictionaries: Record<Locale, Dictionary> = { en, ja };

export const getDictionary = (locale: Locale) => dictionaries[locale];
