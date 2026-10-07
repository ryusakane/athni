"use client";

import { useState, type ComponentProps, type ReactNode } from "react";

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

// Password field with an eye button that shows or hides what was typed.
export function PasswordInput({
  showLabel,
  hideLabel,
  ...props
}: ComponentProps<"input"> & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${inputClass} pr-10 ${props.className ?? ""}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-foreground/60 hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </span>
  );
}

// Year / month / day pickers, so any past date is quick to choose (the native date
// picker opens on today and needs many clicks to reach a birth year).
export function DateSelect({
  name,
  required,
  defaultValue,
  fromYear,
  toYear,
  labels,
}: {
  name: string;
  required?: boolean;
  defaultValue?: string | null;
  fromYear: number;
  toYear: number;
  labels: { year: string; month: string; day: string };
}) {
  const [y0, m0, d0] = (defaultValue ?? "").split("-");
  const [year, setYear] = useState(y0 ?? "");
  const [month, setMonth] = useState(m0 ?? "");
  const [day, setDay] = useState(d0 ?? "");
  const daysInMonth = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const value = year && month && day && Number(day) <= daysInMonth ? `${year}-${month}-${day}` : "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const range = (from: number, to: number) =>
    Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => (from <= to ? from + i : from - i));
  const selectClass = `${inputClass} w-auto`;
  return (
    <span className="flex gap-2">
      <select aria-label={labels.year} required={required} value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
        <option value="">{labels.year}</option>
        {range(toYear, fromYear).map((n) => (
          <option key={n} value={String(n)}>{n}</option>
        ))}
      </select>
      <select aria-label={labels.month} required={required} value={month} onChange={(e) => setMonth(e.target.value)} className={selectClass}>
        <option value="">{labels.month}</option>
        {range(1, 12).map((n) => (
          <option key={n} value={pad(n)}>{n}</option>
        ))}
      </select>
      <select aria-label={labels.day} required={required} value={day} onChange={(e) => setDay(e.target.value)} className={selectClass}>
        <option value="">{labels.day}</option>
        {range(1, daysInMonth).map((n) => (
          <option key={n} value={pad(n)}>{n}</option>
        ))}
      </select>
      <input type="hidden" name={name} value={value} />
    </span>
  );
}
