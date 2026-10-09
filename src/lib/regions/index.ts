import type { Locale } from "@/i18n/config";

// Countries and Japanese prefectures for the address on a student's profile.
// Prefectures are stored by their Japanese name (東京都) in every language, because the
// results data uses those names and matching compares them.

export const prefecturesJp: { ja: string; en: string }[] = [
  { ja: "北海道", en: "Hokkaido" },
  { ja: "青森県", en: "Aomori" },
  { ja: "岩手県", en: "Iwate" },
  { ja: "宮城県", en: "Miyagi" },
  { ja: "秋田県", en: "Akita" },
  { ja: "山形県", en: "Yamagata" },
  { ja: "福島県", en: "Fukushima" },
  { ja: "茨城県", en: "Ibaraki" },
  { ja: "栃木県", en: "Tochigi" },
  { ja: "群馬県", en: "Gunma" },
  { ja: "埼玉県", en: "Saitama" },
  { ja: "千葉県", en: "Chiba" },
  { ja: "東京都", en: "Tokyo" },
  { ja: "神奈川県", en: "Kanagawa" },
  { ja: "新潟県", en: "Niigata" },
  { ja: "富山県", en: "Toyama" },
  { ja: "石川県", en: "Ishikawa" },
  { ja: "福井県", en: "Fukui" },
  { ja: "山梨県", en: "Yamanashi" },
  { ja: "長野県", en: "Nagano" },
  { ja: "岐阜県", en: "Gifu" },
  { ja: "静岡県", en: "Shizuoka" },
  { ja: "愛知県", en: "Aichi" },
  { ja: "三重県", en: "Mie" },
  { ja: "滋賀県", en: "Shiga" },
  { ja: "京都府", en: "Kyoto" },
  { ja: "大阪府", en: "Osaka" },
  { ja: "兵庫県", en: "Hyogo" },
  { ja: "奈良県", en: "Nara" },
  { ja: "和歌山県", en: "Wakayama" },
  { ja: "鳥取県", en: "Tottori" },
  { ja: "島根県", en: "Shimane" },
  { ja: "岡山県", en: "Okayama" },
  { ja: "広島県", en: "Hiroshima" },
  { ja: "山口県", en: "Yamaguchi" },
  { ja: "徳島県", en: "Tokushima" },
  { ja: "香川県", en: "Kagawa" },
  { ja: "愛媛県", en: "Ehime" },
  { ja: "高知県", en: "Kochi" },
  { ja: "福岡県", en: "Fukuoka" },
  { ja: "佐賀県", en: "Saga" },
  { ja: "長崎県", en: "Nagasaki" },
  { ja: "熊本県", en: "Kumamoto" },
  { ja: "大分県", en: "Oita" },
  { ja: "宮崎県", en: "Miyazaki" },
  { ja: "鹿児島県", en: "Kagoshima" },
  { ja: "沖縄県", en: "Okinawa" },
];

// ISO 3166-1 alpha-2 codes. Names come from the browser (Intl.DisplayNames) in the page language.
const countryCodes = (
  "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW"
).split(" ");

export function countryOptions(lang: Locale): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([lang], { type: "region" });
  const all = countryCodes.map((code) => ({ code, name: names.of(code) ?? code }));
  all.sort((a, b) => a.name.localeCompare(b.name, lang));
  // Japan first while most students are there.
  return [...all.filter((c) => c.code === "JP"), ...all.filter((c) => c.code !== "JP")];
}

export function prefectureLabel(value: string | null, lang: Locale): string {
  if (!value) return "";
  const known = prefecturesJp.find((p) => p.ja === value);
  return known && lang === "en" ? known.en : value;
}
