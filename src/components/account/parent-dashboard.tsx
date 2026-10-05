"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getSupabase } from "@/lib/supabase/client";
import { formatDate } from "@/lib/golf/format";
import { StudentDashboard } from "./student-dashboard";
import { buttonClass, Field, Input, Notice, Section, secondaryButtonClass } from "./ui";

type Child = {
  student_id: string;
  consented_at: string | null;
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
      .select("student_id, consented_at")
      .eq("parent_id", parentId);
    const ids = (links ?? []).map((l) => l.student_id as string);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] };
    const names = new Map((profiles ?? []).map((row) => [row.id as string, row.display_name as string]));
    setChildren(
      (links ?? []).map((l) => ({
        student_id: l.student_id,
        consented_at: l.consented_at,
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

  async function setConsent(studentId: string, consent: boolean) {
    await getSupabase().rpc("set_parent_consent", { student: studentId, consent });
    await load();
  }

  if (!children) return <p className="text-sm">{t.loading}</p>;

  return (
    <>
      <Section title={p.children}>
        {children.length === 0 && <p className="text-sm text-foreground/70">{p.none}</p>}
        {children.map((child) => (
          <div key={child.student_id} className="space-y-3 border-b border-black/5 pb-4 last:border-0 dark:border-white/10">
            <p className="font-semibold">{child.name}</p>
            {child.consented_at ? (
              <div className="flex flex-wrap items-center gap-3">
                <Notice tone="success">{p.consented(formatDate(lang, child.consented_at.slice(0, 10)))}</Notice>
                <button
                  type="button"
                  onClick={() => setConsent(child.student_id, false)}
                  className="text-xs underline"
                >
                  {p.withdraw}
                </button>
              </div>
            ) : (
              <ConsentForm lang={lang} onConsent={() => setConsent(child.student_id, true)} />
            )}
          </div>
        ))}
      </Section>

      <Section title={p.linkTitle}>
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
          <p className="text-sm text-foreground/70">{p.viewing}</p>
          <StudentDashboard lang={lang} studentId={child.student_id} asParent />
        </div>
      ))}
    </>
  );
}

function ConsentForm({ lang, onConsent }: { lang: Locale; onConsent: () => void }) {
  const p = getAccountDictionary(lang).parent;
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="space-y-3">
      <label className="flex gap-2 text-sm">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
        <span>{p.consent}</span>
      </label>
      <button type="button" disabled={!agreed} onClick={onConsent} className={buttonClass}>
        {p.giveConsent}
      </button>
    </div>
  );
}
