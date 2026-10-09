"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getSupabase } from "@/lib/supabase/client";
import { StudentDashboard } from "./student-dashboard";
import { Field, Input, Notice, Section, secondaryButtonClass } from "./ui";

type Child = {
  student_id: string;
  name: string;
};

export function ParentDashboard({
  lang,
  parentId,
  pendingInviteCode,
}: {
  lang: Locale;
  parentId: string;
  pendingInviteCode?: string;
}) {
  const t = getAccountDictionary(lang);
  const p = t.parent;
  const [children, setChildren] = useState<Child[] | null>(null);
  const [linkError, setLinkError] = useState(false);
  const triedInvite = useRef(false);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data: links } = await supabase
      .from("guardian_links")
      .select("student_id")
      .eq("parent_id", parentId);
    const ids = (links ?? []).map((l) => l.student_id as string);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] };
    const names = new Map((profiles ?? []).map((row) => [row.id as string, row.display_name as string]));
    setChildren(
      (links ?? []).map((l) => ({
        student_id: l.student_id,
        name: names.get(l.student_id) ?? "",
      })),
    );
  }, [parentId]);

  const link = useCallback(
    async (code: string) => {
      const { error } = await getSupabase().rpc("link_child", { invite_code: code });
      setLinkError(Boolean(error));
      await load();
      return !error;
    },
    [load],
  );

  useEffect(() => {
    // A code entered at signup is linked on first visit, since linking needs a signed-in user.
    if (pendingInviteCode && !triedInvite.current) {
      triedInvite.current = true;
      link(pendingInviteCode).then((ok) =>
        ok ? getSupabase().auth.updateUser({ data: { invite_code: null } }) : undefined,
      );
    } else {
      load();
    }
  }, [link, load, pendingInviteCode]);

  async function onLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const code = String(new FormData(formEl).get("code") ?? "").trim();
    if (code && (await link(code))) formEl.reset();
  }

  if (!children) return <p className="text-sm">{t.loading}</p>;

  return (
    <>
      <Section title={p.linkTitle}>
        {children.length === 0 && <p className="text-sm text-foreground/70">{p.none}</p>}
        <p className="text-sm text-foreground/70">{p.linkLead}</p>
        <form onSubmit={onLink} className="flex items-end gap-3">
          <Field label={p.codeLabel}>
            <Input name="code" required className="uppercase" autoComplete="off" />
          </Field>
          <button type="submit" className={secondaryButtonClass}>
            {p.link}
          </button>
        </form>
        {linkError && <Notice tone="error">{p.linkFailed}</Notice>}
      </Section>

      {children.map((child) => (
        <div key={child.student_id} className="space-y-6">
          <h2 className="pt-4 text-xl font-semibold">{child.name}</h2>
          <StudentDashboard lang={lang} studentId={child.student_id} asParent view="home" />
        </div>
      ))}
    </>
  );
}

