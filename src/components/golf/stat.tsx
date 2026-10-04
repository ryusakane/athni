export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <dt className="text-xs text-foreground/60">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {note && <dd className="mt-1 text-xs text-foreground/50">{note}</dd>}
    </div>
  );
}
