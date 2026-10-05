# アメリカ大学ゴルフ部データ

NCAA の大学ゴルフ部 (まず D1、のちに D2・D3) の基本情報・ランキング・コーチ連絡先・SNS・ロスター・プロになった卒業生。
表は `supabase/migrations/0003_colleges.sql`、サイトは `/[lang]/colleges`。

## 構成

```
data/colleges/
  raw/<division>/<slug>.json    大学ごとの記録 (下の形)。division は d1 / d2 / d3
  rankings/<source>-<gender>-<division>-<as_of>.json   ランキング表 (下の形)
  ISSUES.md                     ランキングの照合漏れ・未収集項目の件数 (自動生成)
```

再生成: `python3 data/scripts/build_colleges.py`
→ `src/data/colleges.json` (サイト用) と `data/supabase/colleges_seed.sql` (Supabase 投入用) を書く。

## raw/<division>/<slug>.json

1大学1ファイル。男子・女子は `programs` に別々に入れる (どちらか一方しかない大学は片方だけ)。
形は `src/lib/colleges/types.ts` の `College` と同じ。`rankings` は書かない (rankings/ から付く)。

```json
{
  "slug": "stanford",                         // ファイル名と同じ。小文字・ハイフン
  "name_en": "Stanford University",           // 正式名
  "name_ja": null,                            // 日本語で通用している表記があれば
  "short_name": "Stanford",                   // ランキング表・結果での名前
  "aliases": [],                              // ランキング表で使われる別名 (照合用、サイトには出ない)
  "nickname": "Cardinal",
  "division": "D1",
  "conference": "ACC",
  "city": "Stanford",
  "state": "CA",                              // USPS 2文字
  "website_url": "https://www.stanford.edu",
  "athletics_url": "https://gostanford.com",
  "programs": [
    {
      "gender": "male",                       // male | female
      "golf_url": "https://gostanford.com/sports/mens-golf",
      "roster_url": "...", "coaches_url": "...",
      "instagram_url": null, "x_url": null, "facebook_url": null, "tiktok_url": null, "youtube_url": null,
      "roster_season": "2026-27",
      "roster_source_url": "...",
      "collected_at": "2026-10-05",
      "coaches": [
        {"name": "Conrad Ray", "title": "...", "email": null, "phone": null, "source_url": "..."}
      ],
      "roster": [
        {"name": "Jay Leng", "class_year": "JR", "redshirt": false,
         "hometown": "San Diego, California", "country": "US", "previous_school": null}
      ],
      "alumni_pros": [
        {"name": "...", "tours": ["PGA Tour"], "final_college_year": 2019, "country": "US", "source_url": "..."}
      ]
    }
  ],
  "sources": [
    {"url": "https://gostanford.com/sports/mens-golf/roster", "reuse_status": "ok", "note": "..."}
  ]
}
```

- `class_year`: FR / SO / JR / SR / GR (大学院・5年目)。"R-So." などのレッドシャツは `redshirt: true` + 学年。
- `country`: ISO 3166-1 alpha-2。米国内の出身地は `US`、海外は出身地の国。日本人選手は `JP` (サイトで日本人選手として数える)。
- コーチ: 大学の体育局公式サイトに載っている名前・役職・メール・電話だけ。個人の SNS や推測したメールアドレスは入れない。
- SNS: そのゴルフ部の公式アカウント (体育局全体のアカウントではなく)。見つからなければ null。
- `alumni_pros`: PGA Tour / LPGA Tour / Korn Ferry Tour / Epson Tour / DP World Tour / LET / JGTO / JLPGA などのツアーメンバー。
  出典 (大学の公式ページ、ツアーの選手ページ、Wikipedia など) を `source_url` に。
- `sources[].reuse_status`: `ok` / `unknown` / `restricted`。規約で転載が禁じられている出典は `restricted` にすると、
  その大学はサイトと seed.sql から外れる (関東高ゴ連と同じ扱い)。

## rankings/*.json

```json
{
  "source": "Golf Channel preseason",
  "as_of": "2026-08-31",
  "source_url": "https://...",
  "division": "D1",
  "gender": "male",
  "entries": [{"rank": 1, "team": "Florida"}]
}
```

`team` は raw の `name_en` / `short_name` / `aliases` と照合する。合わないものは ISSUES.md に出るので aliases を足す。
サイトは各チームの一番新しいランキングを表示し、同じ日付なら Clippd Scoreboard (NCAA 公式) を優先する。

## 現状

- 2026-10-05: Golf Channel の男子プレシーズン Top 40 (2026-08-31) の40校を仮登録。Stanford 男子のみロスター・コーチを公式サイトから収集。
  残りの D1 全校 (男子 約300・女子 約260) は収集中。
