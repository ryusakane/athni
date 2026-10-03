import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "大会・成績",
};

export default function TournamentsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">大会・成績</h1>
      <p className="mt-4 text-foreground/70">
        大会と成績のデータは Supabase 接続後に表示されます。
      </p>
    </div>
  );
}
