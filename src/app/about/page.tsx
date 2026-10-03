import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "概要",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">概要</h1>
      <p className="mt-4 text-foreground/70">
        Athni は、日本全国の高校生ゴルファーの選手情報、大会、成績を集約して公開するサービスです。
      </p>
    </div>
  );
}
