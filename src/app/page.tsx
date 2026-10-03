import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-24">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Athni</h1>
      <p className="mt-6 max-w-2xl text-lg text-foreground/70">
        全国の高校生ゴルファーの選手データ、大会情報、成績をひとつにまとめて見られるサービスです。
      </p>
      <div className="mt-10 flex gap-4">
        <Link
          href="/players"
          className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90"
        >
          選手を探す
        </Link>
        <Link
          href="/tournaments"
          className="rounded-full border border-black/15 px-6 py-3 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          大会・成績を見る
        </Link>
      </div>
    </div>
  );
}
