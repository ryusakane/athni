-- Accounts: one site, a role chosen at signup.
--   student  – a high school athlete; edits their own profile and college list.
--   parent   – a guardian linked to a student (optional); can view and help edit their profile.
--   coach    – a US college coach; verified by a confirmed .edu email, saves players.
--   hs_coach – a Japanese high school teacher/coach. Reserved: not offered at signup yet.
-- The site is a static export, so every rule lives here in row level security.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('student', 'parent', 'coach', 'hs_coach')),
  display_name text not null default '',
  locale text not null default 'en' check (locale in ('en', 'ja')),
  created_at timestamptz not null default now()
);

create table student_profiles (
  user_id uuid primary key references profiles (id) on delete cascade,
  name_ja text,
  name_en text,
  birth_date date,
  graduation_year int check (graduation_year between 2000 and 2100),
  gender text check (gender in ('male', 'female')),
  school_name text,
  prefecture text,
  sport text not null default 'golf',
  bio text,
  -- Academics and golf details entered by the student (or a linked parent).
  gpa_jp numeric(2, 1) check (gpa_jp between 1.0 and 5.0), -- 評定平均 (5-point scale)
  gpa_us numeric(3, 2) check (gpa_us between 0 and 4.0),   -- unweighted 4.0 scale, if known
  intended_major text,
  ncaa_eligibility_id text,
  handicap numeric(3, 1),
  video_url text,
  -- Code the student gives a parent so the parent can link to this account.
  parent_invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  visible_to_coaches boolean not null default false,
  updated_at timestamptz not null default now()
);

create table coach_profiles (
  user_id uuid primary key references profiles (id) on delete cascade,
  college_name text,
  title text,
  sport text not null default 'golf',
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

-- English and admission test results. One row per test sitting.
create table student_test_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student_profiles (user_id) on delete cascade,
  test text not null check (test in ('toefl_ibt', 'ielts', 'duolingo', 'eiken', 'toeic', 'sat', 'act')),
  score text not null, -- text: Eiken is a grade (e.g. "準1級"), others are numbers
  taken_on date,
  created_at timestamptz not null default now()
);

-- "This results record is me." Results already in the DB are linked to an account only
-- after staff approve the claim (update status with the service role).
create table player_claims (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student_profiles (user_id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, player_id)
);

-- A tournament result missing from the DB. Students cannot add results themselves; staff
-- check the source and add the official result to tournaments/tournament_results.
create table result_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student_profiles (user_id) on delete cascade,
  tournament_name text not null,
  start_date date,
  venue text,
  position text,
  scores text, -- e.g. "72-70"
  source_url text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'added', 'rejected')),
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Ready for the hs_coach role; nothing writes here yet.
create table hs_coach_profiles (
  user_id uuid primary key references profiles (id) on delete cascade,
  school_name text,
  prefecture text,
  title text,
  updated_at timestamptz not null default now()
);

create table guardian_links (
  parent_id uuid not null references profiles (id) on delete cascade,
  student_id uuid not null references student_profiles (user_id) on delete cascade,
  relationship text,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

-- Colleges a student is interested in. college_slug matches the colleges pages when present.
create table student_target_colleges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references student_profiles (user_id) on delete cascade,
  college_name text not null,
  college_slug text,
  status text not null default 'interested'
    check (status in ('interested', 'contacted', 'applied', 'offer', 'committed', 'dropped')),
  note text,
  created_at timestamptz not null default now()
);

-- Players a coach is following.
create table coach_saved_players (
  coach_id uuid not null references coach_profiles (user_id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  primary key (coach_id, player_id)
);

-- Helpers used by policies. security definer so they can read across RLS without recursion.

create function public.is_verified_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from coach_profiles
    where user_id = auth.uid() and verification_status = 'verified'
  );
$$;

create function public.is_guardian_of(student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from guardian_links where parent_id = auth.uid() and student_id = student
  );
$$;

-- New auth user → profile row for the role chosen at signup (raw_user_meta_data.role).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  chosen text := meta ->> 'role';
begin
  -- hs_coach is in the schema but not open for signup yet.
  if chosen is null or chosen not in ('student', 'parent', 'coach') then
    raise exception 'invalid role: %', coalesce(chosen, '(none)');
  end if;

  insert into profiles (id, role, display_name, locale)
  values (
    new.id,
    chosen,
    coalesce(meta ->> 'display_name', ''),
    case when meta ->> 'locale' = 'ja' then 'ja' else 'en' end
  );

  if chosen = 'student' then
    insert into student_profiles (user_id, birth_date, graduation_year)
    values (
      new.id,
      nullif(meta ->> 'birth_date', '')::date,
      nullif(meta ->> 'graduation_year', '')::int
    );
  elsif chosen = 'coach' then
    insert into coach_profiles (user_id, college_name, title)
    values (new.id, meta ->> 'college_name', meta ->> 'title');
  end if;

  perform public.verify_edu_coach(new.id, new.email, new.email_confirmed_at);
  return new;
end;
$$;

-- A coach whose confirmed email is on a .edu domain is verified automatically.
-- Others stay pending until staff check them (update coach_profiles with the service role).
create function public.verify_edu_coach(uid uuid, email text, confirmed_at timestamptz)
returns void
language sql security definer set search_path = public as $$
  update coach_profiles
  set verification_status = 'verified', verified_at = now()
  where user_id = uid
    and verification_status = 'pending'
    and confirmed_at is not null
    and lower(email) like '%.edu';
$$;

create function public.handle_user_email_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.verify_edu_coach(new.id, new.email, new.email_confirmed_at);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at, email on auth.users
  for each row execute function public.handle_user_email_confirmed();

-- A parent links to a student with the code the student shared.
create function public.link_child(invite_code text, relationship text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  child uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'parent') then
    raise exception 'only parent accounts can link a student';
  end if;
  select user_id into child from student_profiles
  where parent_invite_code = upper(trim(invite_code));
  if child is null then
    raise exception 'invite code not found';
  end if;
  insert into guardian_links (parent_id, student_id, relationship)
  values (auth.uid(), child, relationship)
  on conflict do nothing;
  return child;
end;
$$;

-- Columns users may not change themselves: role, verification, invite code, review status.
create function public.protect_account_columns() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_table_name = 'profiles' then
    new.role := old.role;
  elsif tg_table_name = 'student_profiles' then
    new.parent_invite_code := old.parent_invite_code;
    new.updated_at := now();
  elsif tg_table_name in ('player_claims', 'result_requests') then
    new.status := old.status;
    new.reviewer_note := old.reviewer_note;
    new.reviewed_at := old.reviewed_at;
    new.student_id := old.student_id;
  elsif tg_table_name = 'coach_profiles' then
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger protect_columns before update on profiles
  for each row execute function public.protect_account_columns();
create trigger protect_columns before update on student_profiles
  for each row execute function public.protect_account_columns();
create trigger protect_columns before update on coach_profiles
  for each row execute function public.protect_account_columns();
create trigger protect_columns before update on player_claims
  for each row execute function public.protect_account_columns();
create trigger protect_columns before update on result_requests
  for each row execute function public.protect_account_columns();

-- New claims and requests always start pending.
create function public.force_pending() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  new.status := 'pending';
  new.reviewer_note := null;
  new.reviewed_at := null;
  return new;
end;
$$;

create trigger force_pending before insert on player_claims
  for each row execute function public.force_pending();
create trigger force_pending before insert on result_requests
  for each row execute function public.force_pending();

alter table profiles enable row level security;
alter table student_profiles enable row level security;
alter table coach_profiles enable row level security;
alter table student_test_scores enable row level security;
alter table player_claims enable row level security;
alter table result_requests enable row level security;
alter table hs_coach_profiles enable row level security;
alter table guardian_links enable row level security;
alter table student_target_colleges enable row level security;
alter table coach_saved_players enable row level security;

-- profiles: rows are created by the signup trigger only.
create policy "own profile" on profiles for select using (id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid());
create policy "linked parents see student" on profiles for select
  using (public.is_guardian_of(id));
create policy "students see linked parents" on profiles for select
  using (exists (select 1 from guardian_links where parent_id = profiles.id and student_id = auth.uid()));
create policy "verified coaches see shown students" on profiles for select
  using (public.is_verified_coach() and exists (
    select 1 from student_profiles s where s.user_id = profiles.id and s.visible_to_coaches));

-- student_profiles
create policy "own student profile" on student_profiles for select using (user_id = auth.uid());
create policy "own student profile update" on student_profiles for update using (user_id = auth.uid());
create policy "linked parents read" on student_profiles for select
  using (public.is_guardian_of(user_id));
create policy "linked parents update" on student_profiles for update
  using (public.is_guardian_of(user_id));
create policy "verified coaches read shown students" on student_profiles for select
  using (visible_to_coaches and public.is_verified_coach());

-- coach_profiles
create policy "own coach profile" on coach_profiles for select using (user_id = auth.uid());
create policy "own coach profile update" on coach_profiles for update using (user_id = auth.uid());

-- hs_coach_profiles
create policy "own hs coach profile" on hs_coach_profiles for select using (user_id = auth.uid());
create policy "own hs coach profile update" on hs_coach_profiles for update using (user_id = auth.uid());

-- guardian_links: created through link_child().
create policy "own links" on guardian_links for select
  using (parent_id = auth.uid() or student_id = auth.uid());
create policy "parent unlinks" on guardian_links for delete using (parent_id = auth.uid());

-- student_target_colleges: the student and their linked parents.
create policy "student or parent read" on student_target_colleges for select
  using (student_id = auth.uid() or public.is_guardian_of(student_id));
create policy "student or parent insert" on student_target_colleges for insert
  with check (student_id = auth.uid() or public.is_guardian_of(student_id));
create policy "student or parent update" on student_target_colleges for update
  using (student_id = auth.uid() or public.is_guardian_of(student_id));
create policy "student or parent delete" on student_target_colleges for delete
  using (student_id = auth.uid() or public.is_guardian_of(student_id));

-- Test scores, claims and requests: the student and their linked parents.
create policy "student or parent read" on student_test_scores for select
  using (student_id = auth.uid() or public.is_guardian_of(student_id));
create policy "verified coaches read shown students" on student_test_scores for select
  using (public.is_verified_coach() and exists (
    select 1 from student_profiles s where s.user_id = student_id and s.visible_to_coaches));
create policy "student or parent insert" on student_test_scores for insert
  with check (student_id = auth.uid() or public.is_guardian_of(student_id));
create policy "student or parent update" on student_test_scores for update
  using (student_id = auth.uid() or public.is_guardian_of(student_id));
create policy "student or parent delete" on student_test_scores for delete
  using (student_id = auth.uid() or public.is_guardian_of(student_id));

create policy "student or parent read" on player_claims for select
  using (student_id = auth.uid() or public.is_guardian_of(student_id));
create policy "student or parent insert" on player_claims for insert
  with check (student_id = auth.uid() or public.is_guardian_of(student_id));
create policy "withdraw pending claim" on player_claims for delete
  using ((student_id = auth.uid() or public.is_guardian_of(student_id)) and status = 'pending');
create policy "verified coaches read approved claims" on player_claims for select
  using (status = 'approved' and public.is_verified_coach() and exists (
    select 1 from student_profiles s where s.user_id = student_id and s.visible_to_coaches));

create policy "student or parent read" on result_requests for select
  using (student_id = auth.uid() or public.is_guardian_of(student_id));
create policy "student or parent insert" on result_requests for insert
  with check (student_id = auth.uid() or public.is_guardian_of(student_id));
create policy "withdraw pending request" on result_requests for delete
  using ((student_id = auth.uid() or public.is_guardian_of(student_id)) and status = 'pending');

-- coach_saved_players: verified coaches only.
create policy "own saved players" on coach_saved_players for select using (coach_id = auth.uid());
create policy "verified coach saves" on coach_saved_players for insert
  with check (coach_id = auth.uid() and public.is_verified_coach());
create policy "own saved players update" on coach_saved_players for update using (coach_id = auth.uid());
create policy "own saved players delete" on coach_saved_players for delete using (coach_id = auth.uid());

-- Postgres grants execute to everyone by default. Only signed-in users call the RPCs,
-- and nobody may call verify_edu_coach() directly (it would let a coach verify themselves).
revoke execute on function public.verify_edu_coach(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.link_child(text, text) from public, anon;
grant execute on function public.link_child(text, text) to authenticated;
