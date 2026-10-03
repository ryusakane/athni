import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-24">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Athni</h1>
      <p className="mt-6 max-w-2xl text-lg text-foreground/70">
        ここにサービスのキャッチコピーと説明文が入ります。
      </p>
      <div className="mt-10 flex gap-4">
        <Link
          href="/about"
          className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90"
        >
          詳しく見る
        </Link>
        <Link
          href="/contact"
          className="rounded-full border border-black/15 px-6 py-3 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          お問い合わせ
        </Link>
      </div>
    </div>
  );
}
