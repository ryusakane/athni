import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "お問い合わせ",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">お問い合わせ</h1>
      <p className="mt-4 text-foreground/70">
        お問い合わせフォームは Supabase 接続後に追加予定です。
      </p>
    </div>
  );
}
