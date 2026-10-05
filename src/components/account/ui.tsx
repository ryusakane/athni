import type { ComponentProps, ReactNode } from "react";

// Small form building blocks shared by the account screens.

export const inputClass =
  "w-full rounded-md border border-black/15 bg-background px-3 py-2 text-sm outline-none focus:border-foreground/60 dark:border-white/20";

export const buttonClass =
  "inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-foreground/5 disabled:opacity-50 dark:border-white/20";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-foreground/60">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-black/10 p-5 dark:border-white/10">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const color = {
    info: "bg-foreground/5",
    error: "bg-red-500/10 text-red-700 dark:text-red-300",
    success: "bg-green-500/10 text-green-800 dark:text-green-300",
  }[tone];
  return <p className={`rounded-md px-3 py-2 text-sm ${color}`}>{children}</p>;
}
