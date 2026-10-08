# 高校生ゴルファーの大会・成績データ

日本の高校生ゴルファーの公開されている大会結果を集め、`supabase/migrations/0001_init.sql`
（`claude/initial-website-5qeniv` ブランチ）の表に合わせて CSV にしたもの。

## 構成

```
data/
  raw/<source>/<tournament>.json   大会×部門×形式ごとの書き起こし (元データ)
  reference/                       英語表記・コース・天候などの補助データ
    translations.json              大会名の英訳ルール、確認済みの選手・学校英語表記
    name_parts.json                姓・名ごとの読み (推定、confidence 付き)
    school_names.json              学校の正式名・英語名 (official / web / estimated)
    courses.json                   コース・ティー (コースレート/スロープ)・緯度経度
    weather.json                   コース×日付の天候 (気象庁 過去の気象データ)
    source_terms.json              出典ごとの再利用条件
  scripts/build.py                 raw + reference → 下の CSV を生成
  *.csv                            Supabase 投入用 (下表)
  ISSUES.md                        書き起こし・名寄せの要確認事項 (自動生成)
  SOURCES.md                       出典の一覧と各サイトが公開している内容
```

再生成: `pip install pykakasi namedivider-python && python3 data/scripts/build.py`

## 選手の名寄せ

`build.py` は同姓同名 (空白・異体字 髙/高 などは無視) の選手を次の順にまとめる。

1. `reference/player_merge_decisions.csv` に人が書いた判断 (`same` はまとめる、`different` はまとめない)。
2. 学校・県・卒業年度のうち2つ以上が一致すれば同一人物。学校名は略称・表記ゆれ (「岐阜聖徳」「日体荏原」「都立駒場」など) も同じ学校とみなす。
3. 学校・県・卒業年度のうち1つ以下しかわからない記録 (日本ジュニア・国スポなど) は、2つ以上わかっている同名の選手のうち食い違いのないのが1人だけなら仮にまとめる。

同じ大会に両方出ている2人と、性別の違う2人はまとめない。まとめた組は `ISSUES.md` (`player-dedup`) に残る。

`player_name_review.csv` は人が確認する一覧。`status` が「未統合」はルールでは決められなかった同姓同名、「統合済み (要確認)」は 3 で仮にまとめた組。
判断したら `player_key_a`・`player_key_b` と `decision` を `reference/player_merge_decisions.csv` に写して作り直す。

## Supabase への投入

`supabase/seed.sql` をそのまま流せば入る (Supabase の SQL Editor に貼る、または `psql "$DATABASE_URL" -f data/supabase/seed.sql`)。

- 前提: `supabase/migrations/` の 0001 と 0002 を先に適用。
- 同じ内容を `src/data/seed.json` にも書き出す。サイトは Supabase の環境変数がないときこれを表示する。
- 各行の id は `*_key` から作る固定の UUID なので、何度流しても重複せず、作り直しても同じ選手は同じ id。
- 公開に許諾が必要な大会 (関東高ゴ連) と団体戦 (スキーマに表がない) は含めていない。
- 載せる大会は `supabase/published_tournaments.txt` に絞る (サイトの静的ファイル数を Cloudflare の無料枠に収めるため)。全大会は `to_sql.py --all`。
- 再生成: `python3 data/scripts/build.py && python3 data/scripts/to_sql.py` (`--include-restricted` で関東も含める)。
- ローカルの PostgreSQL でマイグレーション → seed を2回流して、エラーなく同じ件数になることを確認済み。

## CSV とテーブルの対応

主キー・外部キーは UUID の代わりに `*_key` (読める文字列 or ハッシュ)。投入時に key → uuid を引き当てる。
スキーマにない列は補足情報 (表示や検証に使う想定)。

| CSV | テーブル | スキーマ外の列 |
|---|---|---|
| schools.csv | schools | name_short_ja (結果表の略称), name_en_source, kind, name_en_source_url |
| players.csv | players | name_en_source |
| courses.csv | courses | source_url |
| course_tees.csv | course_tees | source_url |
| tournaments.csv | tournaments | event_type (junior / high_school / amateur / professional), season_year, region, format, venue_ja, par, yardage, result_pdf_urls, complete, row_count, field_size_total, reuse_status, reuse_note |
| tournament_results.csv | tournament_results | amateur, field_size, percentile (上位何%), strokes_behind_winner, avg_differential |
| rounds.csv | rounds | holes, weather_en, differential, weather_station |
| team_results.csv / team_members.csv | (なし) | 団体戦。スキーマに団体の表がないため別ファイル |

- 一般アマ・プロ大会 (日本アマ、地区オープン等) は高校生の行だけを書き起こしている。`position` は大会全体での順位、`field_size`・`percentile` は大会全体の人数 (`field_size_total`) で計算し、優勝者が高校生でない大会では `strokes_behind_winner` は空。
- `position`/`tied`: 「T3」は position=3, tied=true。予選落ちは status=cut, position 空。
- `graduation_year`: 学年と大会日付から算出 (4月始まりの学年度。3年生の夏 2025 → 卒業 2026年3月 = 2026)。
- `differential`: WHS 方式 `113 / slope × (score − course rating)`。コースレート・スロープがわかるラウンドだけ。9ホールのラウンドは空。
- `temperature_c`: 当日の最高気温。天候・風速・降水量は会場最寄りの気象庁観測所の日別値。
  気象庁のページが取れなかった日は tenki.jp の値 (天気・最高/最低気温のみ、風速・降水量は空)。
- コースレート・スロープ: 公表されているティーの値。大会は独自のヤーデージで行うことが多いため、
  一番近いティーの値を使い、差は `course_tees.tournament_yardages` で確認できる。女子用のコースレートは公表が少なく、
  女子のラウンドは多くが `differential` 空 (男子用の値は `men_course_rating` 列に参考として残している)。

## 英語表記の扱い

- 大会結果に読み仮名はほぼ載っていないため、選手名のローマ字は**推定**。`name_en_source` が
  `estimated-high/medium/low` (読みの確からしさ) または `auto-unverified` (機械変換のみ)。
  本人・保護者に確認できたら `reference/translations.json` の `players` に入れると優先される。
- 表記は「名 姓」(例: Shizuku Okita)、旅券式ヘボン (長音なし)。
- 学校英語名は学校が公式に使っている名前があればそれ (`official`)、なければ慣例に沿った推定。

## 注意 (未成年のデータ)

- 載せているのは大会結果に公開されている氏名・学校・学年・都道府県・スコアだけ。生年月日・写真・連絡先などは集めていない。
- 関東高等学校・中学校ゴルフ連盟の結果は利用規約上、私的使用を超える転用に同連盟の承諾が必要
  (`tournaments.csv` の `reuse_status=restricted`)。サイトで公開する前に許諾を取ること。
- 書き起こしは PDF/HTML を読み取りモデルで表にしたもの。合計の検算はしているが、氏名の文字単位の確認はしていない。公開前に各大会の上位は原本と突き合わせること。
