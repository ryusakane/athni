# Athni

Next.js（App Router）+ TypeScript + Tailwind CSS で構築した Web サイトです。Vercel へのデプロイを想定しています。

## 開発

```bash
npm install
npm run dev
```

http://localhost:3000 で確認できます。

## 構成

- `src/app/` — ページ（`/`、`/about`、`/contact`）
- `src/components/` — 共通コンポーネント（ヘッダー、フッター）

## Supabase（予定）

データ管理は Supabase に接続予定です。`.env.example` を `.env.local` にコピーし、Supabase プロジェクトの URL と anon key を設定します。
