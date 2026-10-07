-- Student profile fields US college golf coaches look for, and names split into
-- family / given parts. The joined name_ja / name_kana / name_en stay, written by the
-- client on save (and at signup), because coach screens and player claims read them.

alter table student_profiles
  add column family_name_ja text,
  add column given_name_ja text,
  add column family_name_kana text,
  add column given_name_kana text,
  add column family_name_en text,
  add column given_name_en text,
  -- Basics
  add column hometown text,
  add column height_cm int check (height_cm between 100 and 250),
  add column handedness text check (handedness in ('right', 'left')),
  -- Academics
  add column class_rank int check (class_rank > 0),
  add column class_size int check (class_size > 0),
  add column ncaa_status text check (ncaa_status in ('not_registered', 'registered', 'certified')),
  add column entry_year int check (entry_year between 2000 and 2100), -- the fall the student wants to start college
  add column target_divisions text[] not null default '{}'
    check (target_divisions <@ array['d1', 'd2', 'd3', 'naia', 'njcaa']::text[]),
  -- Golf
  add column scoring_average numeric(4, 1) check (scoring_average between 50 and 150), -- 18-hole, last 12 months
  add column scoring_rounds int check (scoring_rounds >= 0),                           -- rounds behind that average
  add column best_18 int check (best_18 between 50 and 150),
  add column best_18_event text,
  add column driving_distance_yd int check (driving_distance_yd between 100 and 450),
  add column wagr_rank int check (wagr_rank > 0),
  add column home_course text,
  add column ranking_url text, -- e.g. Junior Golf Scoreboard, AJGA or WAGR profile
  add column coach_name text,  -- a high school or swing coach a college coach can call
  add column coach_contact text;

-- Names saved before this migration keep only the joined columns; the profile form
-- splits them at the first space when the parts are empty.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  chosen text := meta ->> 'role';
  ja boolean := meta ->> 'locale' = 'ja';
begin
  -- hs_coach is in the schema but not open for signup yet.
  if chosen is null or chosen not in ('student', 'parent', 'coach') then
    raise exception 'invalid role: %', coalesce(chosen, '(none)');
  end if;

  insert into profiles (id, role, display_name, name_kana, locale)
  values (
    new.id,
    chosen,
    coalesce(meta ->> 'display_name', ''),
    nullif(meta ->> 'name_kana', ''),
    case when ja then 'ja' else 'en' end
  );

  if chosen = 'student' then
    insert into student_profiles (
      user_id, name_ja, name_en, name_kana,
      family_name_ja, given_name_ja, family_name_kana, given_name_kana, family_name_en, given_name_en,
      birth_date, graduation_year
    )
    values (
      new.id,
      nullif(meta ->> 'name_ja', ''),
      nullif(meta ->> 'name_en', ''),
      nullif(meta ->> 'name_kana', ''),
      case when ja then nullif(meta ->> 'family_name', '') end,
      case when ja then nullif(meta ->> 'given_name', '') end,
      nullif(meta ->> 'family_kana', ''),
      nullif(meta ->> 'given_kana', ''),
      case when not ja then nullif(meta ->> 'family_name', '') end,
      case when not ja then nullif(meta ->> 'given_name', '') end,
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
