export function SiteFooter() {
  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-foreground/60">
        © {new Date().getFullYear()} Athni
      </div>
    </footer>
  );
}
