-- "Not my tournament": a student (or linked parent) removes a result from their profile with ×.
-- The results data stays as published; the row only hides that result on the student's
-- profile. Staff can read these rows to spot records merged into the wrong player.

create table student_hidden_results (
  student_id uuid not null references student_profiles (user_id) on delete cascade,
  result_id uuid not null references tournament_results (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, result_id)
);

alter table student_hidden_results enable row level security;

create policy "student or parent read" on student_hidden_results for select
  using (student_id = auth.uid() or private.is_guardian_of(student_id));
create policy "student or parent insert" on student_hidden_results for insert
  with check (student_id = auth.uid() or private.is_guardian_of(student_id));
create policy "student or parent delete" on student_hidden_results for delete
  using (student_id = auth.uid() or private.is_guardian_of(student_id));
-- Coaches who can see the student see which results the student removed, so a coach view
-- of the profile can leave them out.
create policy "verified coaches read shown students" on student_hidden_results for select
  using (private.is_verified_coach() and exists (
    select 1 from student_profiles s where s.user_id = student_id and s.visible_to_coaches));
