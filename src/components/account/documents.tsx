"use client";

import { useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { getAccountDictionary } from "@/i18n/account";
import { getSupabase } from "@/lib/supabase/client";
import type { DocumentKind, StudentDocument } from "@/lib/supabase/account-types";
import { inputClass, Notice, Section, secondaryButtonClass } from "./ui";

// Private Storage bucket from supabase/migrations/0010_student_documents.sql.
const bucket = "student-documents";
const maxBytes = 10 * 1024 * 1024;
export const documentKinds: DocumentKind[] = [
  "transcript",
  "graduation",
  "translation",
  "test_report",
  "offer",
  "i20",
  "visa",
  "other",
];

// Opens a stored file in a new tab through a short-lived signed link.
async function openDocument(doc: StudentDocument) {
  const tab = window.open("", "_blank");
  const { data } = await getSupabase().storage.from(bucket).createSignedUrl(doc.storage_path, 60);
  if (data && tab) tab.location.href = data.signedUrl;
  else tab?.close();
}

async function removeDocument(doc: StudentDocument) {
  const supabase = getSupabase();
  await supabase.storage.from(bucket).remove([doc.storage_path]);
  await supabase.from("student_documents").delete().eq("id", doc.id);
}

// A file picker button that uploads straight away. With one kind it is a single button;
// with several, a type picker comes first.
export function UploadButton({
  lang,
  studentId,
  kinds,
  testScoreId,
  label,
  onDone,
}: {
  lang: Locale;
  studentId: string;
  kinds: DocumentKind[];
  testScoreId?: string;
  label?: string;
  onDone: () => void;
}) {
  const s = getAccountDictionary(lang).student;
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocumentKind>(kinds[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    if (file.size > maxBytes) {
      setError(s.fileTooLarge);
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = getSupabase();
    // Keep the original name for display; the stored name is ASCII-safe.
    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
    const path = `${studentId}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
    const stored = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined });
    const row = stored.error
      ? stored
      : await supabase.from("student_documents").insert({
          student_id: studentId,
          kind,
          test_score_id: testScoreId ?? null,
          file_name: file.name,
          storage_path: path,
          size_bytes: file.size,
        });
    setBusy(false);
    if (row.error) setError(row.error.message);
    else onDone();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {kinds.length > 1 && (
          <select
            aria-label={s.documentKind}
            value={kind}
            onChange={(e) => setKind(e.target.value as DocumentKind)}
            className={`${inputClass.replace("w-full", "w-auto")} py-1.5`}
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {s.documentKinds[k]}
              </option>
            ))}
          </select>
        )}
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={secondaryButtonClass}>
          {busy ? s.uploading : (label ?? (kinds.length === 1 ? s.uploadKind(s.documentKinds[kinds[0]]) : s.chooseFile))}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

export function DocumentList({
  lang,
  docs,
  onChange,
}: {
  lang: Locale;
  docs: StudentDocument[];
  onChange: () => void;
}) {
  const t = getAccountDictionary(lang);
  if (docs.length === 0) return null;
  return (
    <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
      {docs.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between gap-4 py-2">
          <button type="button" onClick={() => openDocument(doc)} className="min-w-0 text-left hover:underline">
            <span className="text-xs text-foreground/60">{t.student.documentKinds[doc.kind]} · </span>
            <span className="break-all font-medium">{doc.file_name}</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              await removeDocument(doc);
              onChange();
            }}
            className="whitespace-nowrap text-xs underline"
          >
            {t.remove}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Documents({
  lang,
  studentId,
  docs,
  onChange,
}: {
  lang: Locale;
  studentId: string;
  docs: StudentDocument[];
  onChange: () => void;
}) {
  const s = getAccountDictionary(lang).student;
  return (
    <Section id="documents" title={s.documents}>
      <p className="text-sm text-foreground/70">{s.documentsLead}</p>
      {docs.length > 0 ? (
        <DocumentList lang={lang} docs={docs} onChange={onChange} />
      ) : (
        <p className="text-sm text-foreground/60">{s.noDocuments}</p>
      )}
      <UploadButton lang={lang} studentId={studentId} kinds={documentKinds} onDone={onChange} />
    </Section>
  );
}
