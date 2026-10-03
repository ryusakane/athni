import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "選手一覧",
};

export default function PlayersPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">選手一覧</h1>
      <p className="mt-4 text-foreground/70">
        選手データは Supabase 接続後に表示されます。
      </p>
    </div>
  );
}
