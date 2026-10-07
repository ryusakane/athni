-- Japanese names need both kanji and a katakana reading (フリガナ).
-- Signup sends name_kana for every role, and name_ja for students signing up in Japanese.

alter table profiles add column name_kana text;
alter table student_profiles add column name_kana text;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  chosen text := meta ->> 'role';
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
    case when meta ->> 'locale' = 'ja' then 'ja' else 'en' end
  );

  if chosen = 'student' then
    insert into student_profiles (user_id, name_ja, name_kana, birth_date, graduation_year)
    values (
      new.id,
      nullif(meta ->> 'name_ja', ''),
      nullif(meta ->> 'name_kana', ''),
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
