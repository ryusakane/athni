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

## 収集 (collect/)

`collect/` のスクリプトで集め、`raw/d1/` を書き出す。順に:

```
cd data/colleges/collect
python3 schools.py         # NCAA Directory から D1 で男子/女子ゴルフ部のある大学 → schools.json
python3 collect_sites.py   # 各校の体育局公式サイト → sites/<slug>.json (ゴルフ部ページ・SNS・ロスター・コーチ)
python3 rankings.py        # GCAA コーチ投票 (男子) と NCAA 選手権の最終順位 (男女) → ../rankings/
python3 alumni.py          # Wikipedia のチーム別カテゴリからプロになった卒業生 → alumni/d1.json
python3 merge.py           # 上の結果を raw/d1/<slug>.json にまとめる
cd ../../.. && python3 data/scripts/build_colleges.py
```

- 必要: `pip install requests beautifulsoup4 lxml`。取得したページは `collect/.cache/` に保存 (git 管理外)。
- 取得はすべて `AthniDataBot` を名乗り、robots.txt に従い、同じサイトへは間隔をあけて1件ずつ。
- 出典と再利用条件:
  - **NCAA Directory** (どの大学がゴルフ部を持つか・カンファレンス・州・公式 URL): NCAA.org の規約は「内容の転載・転用には NCAA の書面の同意が必要」。使っているのは事実情報だけ。`reuse_status: unknown`。
  - **各校の体育局公式サイト** (ロスター・コーチ・SNS): 公開ページ。各サイトの規約は個別に確認していない。`unknown`。
  - **GCAA Coaches Poll** (gcaa.coach): 男子 D1 の Top 25。規約の記載なし。`unknown`。
  - **Wikipedia** (NCAA 選手権の最終順位・プロになった卒業生・チームのニックネーム): CC BY-SA 4.0。出典表示が必要。`ok`。
  - **Clippd Scoreboard** (NCAA 公式ランキング): 規約がクローラー・自動取得を禁止しているため**取得していない**。サイトにはリンクのみ。
  - **WGCA (女子コーチ投票)**: サイトが自動アクセスを拒否するため未取得。女子の順位は NCAA 選手権の結果のみ。
- コーチ: 公式サイトのロスター/コーチ欄に出ている人のうち、ヘッドコーチ・アシスタント・ディレクター・オブ・オペレーション等。
  トレーナー・広報・栄養士などは除く。メール・電話は公式サイト (ロスター欄・スタッフディレクトリ) に載っているものだけ。
- 国: 出身地の表記から判定 (米国の州 → US)。日本出身は `JP`。
- プロになった卒業生: Wikipedia のチーム別カテゴリ (例: "Auburn Tigers men's golfers") の選手のうち、ツアーのカテゴリ
  (PGA Tour golfers, LPGA Tour golfers, Korn Ferry Tour golfers, European Tour golfers, LIV Golf players, Japan Golf Tour golfers など) に入っている人。
  Wikipedia に記事がある選手だけなので網羅的ではない。`final_college_year` は未収集。

## 現状

- 2026-10-05: NCAA Directory の D1 ゴルフ部 338校 (男子311・女子290 = 601チーム) を登録。
  - 体育局サイトの多く (約295校) はボット対策 (Imperva) でクラウドからのアクセスを拒否するため、それらは ryu の Mac から同じスクリプトで収集
    (同じ AthniDataBot を名乗り robots.txt に従う。ボット対策の回避はしていない)。
  - ロスター 579チーム (4,870人、日本出身 19人)、コーチ 575チーム、コーチのメールが載っているのは 301チーム、ゴルフ部の SNS 374チーム。
  - 取れなかった大学: Little Rock (robots.txt が全面不許可)、Missouri・Omaha・Tennessee Tech・Colgate (アクセス拒否・応答なし)。
- ランキング: GCAA コーチ投票 男子 Top 25 (2026-09-25)、NCAA 選手権 2026 最終順位 (男女各30校)、Golf Channel プレシーズン (男子)。
- プロになった卒業生: 137校・1,547人 (Wikipedia に記事のある選手のみ)。
- 取れていない項目の件数は ISSUES.md。
