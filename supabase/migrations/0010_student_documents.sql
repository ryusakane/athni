-- Documents a student uploads: transcripts, test score reports, graduation certificates,
-- translations, offer letters, I-20 and visa. Files live in the private Storage bucket
-- student-documents under <student id>/...; this table lists them. Only the student and
-- linked parents can see or change them (not coaches, not the public).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-documents',
  'student-documents',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
on conflict (id) do nothing;

create table student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student_profiles (user_id) on delete cascade,
  kind text not null
    check (kind in ('transcript', 'graduation', 'translation', 'test_report', 'offer', 'i20', 'visa', 'other')),
  -- A score report can belong to one test sitting on the profile.
  test_score_id uuid references student_test_scores (id) on delete set null,
  file_name text not null,
  storage_path text not null unique,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  -- The file must sit in the student's own folder.
  check (storage_path like student_id::text || '/%')
);

alter table student_documents enable row level security;

create policy "student or parent read" on student_documents for select
  using (student_id = auth.uid() or private.is_guardian_of(student_id));
create policy "student or parent insert" on student_documents for insert
  with check (student_id = auth.uid() or private.is_guardian_of(student_id));
create policy "student or parent update" on student_documents for update
  using (student_id = auth.uid() or private.is_guardian_of(student_id));
create policy "student or parent delete" on student_documents for delete
  using (student_id = auth.uid() or private.is_guardian_of(student_id));

-- Storage: the first folder of the object name is the student's id.
create function private.can_edit_student_files(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  folder text := split_part(object_name, '/', 1);
begin
  if folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return folder::uuid = auth.uid() or private.is_guardian_of(folder::uuid);
end;
$$;

revoke execute on function private.can_edit_student_files(text) from public, anon;
grant execute on function private.can_edit_student_files(text) to authenticated;

create policy "student documents read" on storage.objects for select to authenticated
  using (bucket_id = 'student-documents' and private.can_edit_student_files(name));
create policy "student documents upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'student-documents' and private.can_edit_student_files(name));
create policy "student documents delete" on storage.objects for delete to authenticated
  using (bucket_id = 'student-documents' and private.can_edit_student_files(name));
