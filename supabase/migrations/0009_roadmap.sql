-- Roadmap to college entry: the steps a student has checked off on their account page.
-- The steps themselves (order, text, sources) live in the site code (src/i18n/roadmap.ts);
-- some steps are also marked done from profile data in the browser. A row here means the
-- student or a linked parent ticked the step by hand.

create table student_roadmap_steps (
  student_id uuid not null references student_profiles (user_id) on delete cascade,
  step text not null check (step ~ '^[a-z_]{2,32}$'),
  done_at timestamptz not null default now(),
  primary key (student_id, step)
);

alter table student_roadmap_steps enable row level security;

-- The student and their linked parents only. Coaches never see the roadmap.
create policy "student or parent read" on student_roadmap_steps for select
  using (student_id = auth.uid() or private.is_guardian_of(student_id));
create policy "student or parent insert" on student_roadmap_steps for insert
  with check (student_id = auth.uid() or private.is_guardian_of(student_id));
create policy "student or parent delete" on student_roadmap_steps for delete
  using (student_id = auth.uid() or private.is_guardian_of(student_id));
