# Athni

高校生アスリートのアメリカ大学進学を支援するサービスです（https://athtouni.com）。

**全体の説明（サイト構成・データ・アカウントと本人確認・運営作業）は [docs/overview.md](docs/overview.md) にまとめています。**

まずは高校生ゴルファーの選手データ、大会、成績、コース情報（レーティング・スロープ）、天候を英語と日本語で公開します。

Next.js（App Router）+ TypeScript + Tailwind CSS で構築した Web サイトです。静的ファイルとして書き出し、Cloudflare Pages（無料プラン）で公開します。

## 開発

```bash
npm install
npm run dev
```

http://localhost:3000 で確認できます。

## 構成

- `src/app/[lang]/` — ページ（`/en/...` が英語、`/ja/...` が日本語。`/` は `public/index.html` がブラウザの言語に応じて振り分け）
- `src/i18n/` — 言語設定と翻訳文
- `src/components/` — 共通コンポーネント（ヘッダー、フッター）

## 公開（Cloudflare Pages）

Cloudflare の Workers & Pages で GitHub リポジトリを接続します。Workers として作る場合は `wrangler.jsonc` の設定で `out` が公開されるので、Build command に `npm run build`、Deploy command に `npx wrangler deploy` を指定します。Pages として作る場合は次のように設定します。

- Framework preset: Next.js (Static HTML Export)
- Build command: `npm run build`
- Build output directory: `out`

main に変更が入るたびに自動で再公開されます。

## データと Supabase

選手ページ（`/en/players/...`）と大会ページ（`/en/tournaments/...`）は `npm run build` のときにデータを読み、すべて静的な HTML として書き出します。

- `.env.local`（Cloudflare Pages では環境変数）に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` があれば Supabase から読みます。
- なければ同梱の `src/data/seed.json` を使います（`data/scripts/to_sql.py` が `data/supabase/seed.sql` と同じ内容で生成。関東高ゴ連の大会は除外済み）。
- データを更新したら再ビルド（Cloudflare Pages の再デプロイ）で反映されます。

テーブル定義は `supabase/migrations/` にあります（学校、選手、コース、ティーごとのレーティング・スロープ、大会、成績、ラウンドごとのスコアと天候）。
