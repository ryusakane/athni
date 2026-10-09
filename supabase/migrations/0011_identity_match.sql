-- Profile address and high school, and "is this you?" after login.
--   Signup asks a student for their country, prefecture / state, address and high school.
--   After login the account page lists results records whose name matches the student's
--   and whose prefecture or high school matches too. The student picks the one that is them
--   (a player claim, still approved by staff) or says it isn't them (a dismissal).

-- Country (ISO 3166-1 alpha-2, e.g. 'JP') next to the existing prefecture column. Coaches who
-- can see a student can see these, like the hometown.
alter table student_profiles add column country text check (country ~ '^[A-Z]{2}$');

-- The street address is kept apart: only the student and linked parents can read it.
create table student_addresses (
  student_id uuid primary key references student_profiles (user_id) on delete cascade,
  postal_code text,
  address_line text, -- city / town and street
  updated_at timestamptz not null default now()
);

alter table student_addresses enable row level security;
create policy "student or parent read" on student_addresses for select
  using (student_id = auth.uid() or private.is_guardian_of(student_id));
create policy "student or parent insert" on student_addresses for insert
  with check (student_id = auth.uid() or private.is_guardian_of(student_id));
create policy "student or parent update" on student_addresses for update
  using (student_id = auth.uid() or private.is_guardian_of(student_id));

-- "This is not me": the candidate is not shown again.
create table student_player_dismissals (
  student_id uuid not null references student_profiles (user_id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, player_id)
);

alter table student_player_dismissals enable row level security;
create policy "student or parent read" on student_player_dismissals for select
  using (student_id = auth.uid() or private.is_guardian_of(student_id));
create policy "student or parent insert" on student_player_dismissals for insert
  with check (student_id = auth.uid() or private.is_guardian_of(student_id));
create policy "student or parent delete" on student_player_dismissals for delete
  using (student_id = auth.uid() or private.is_guardian_of(student_id));

-- Where a claim came from, so staff can see it was picked from the matched list.
alter table player_claims add column source text not null default 'manual'
  check (source in ('manual', 'profile_match'));

-- Matching keys. Spaces, width and katakana/hiragana are ignored; a few old character forms
-- seen in the results (﨑, 髙, 黑) count as the common ones.
create function private.norm_name(value text) returns text
language sql immutable set search_path = '' as $$
  select nullif(
    lower(translate(
      regexp_replace(normalize(coalesce(value, ''), NFKC), '[[:space:]・･.-]', '', 'g'),
      'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴ﨑髙黑',
      'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔ崎高黒'
    )),
    ''
  );
$$;

-- 東京都 / 東京, 大阪府 / 大阪 and 愛知県 / 愛知 are the same. 北海道 stays as it is.
create function private.norm_pref(value text) returns text
language sql immutable set search_path = '' as $$
  select nullif(nullif(
    lower(regexp_replace(
      regexp_replace(normalize(coalesce(value, ''), NFKC), '[[:space:]]', '', 'g'),
      '(.{2,3})(都|府|県)$', '\1'
    )),
    ''), '不明');
$$;

-- 県立○○高等学校 / ○○高校 / ○○ High School are the same school.
create function private.norm_school(value text) returns text
language sql immutable set search_path = '' as $$
  select nullif(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      lower(regexp_replace(normalize(coalesce(value, ''), NFKC), '[[:space:]・.-]', '', 'g')),
      '^.{0,4}(都|道|府|県)立', ''),
      '^(.{0,6}(市|区|町|村)|私)立', ''),
      '(高等学校|高等部|高校|highschool|school)$', ''),
      '[()（）]', '', 'g'),
    ''
  );
$$;

-- Same school when the keys are equal, or one contains the other (abbreviations such as
-- 日大一 / 日本大学第一 are not caught; the prefecture usually is).
create function private.same_school(a text, b text) returns boolean
language sql immutable set search_path = '' as $$
  select a is not null and b is not null and (
    a = b or (least(length(a), length(b)) >= 3 and (position(a in b) > 0 or position(b in a) > 0))
  );
$$;

-- Results records that may be this student: same name, and same prefecture or high school.
-- Leaves out records the student already claimed or dismissed, and records staff already
-- gave to another account. The student or a linked parent may call it.
create function public.player_matches(student uuid)
returns table (
  player_id uuid,
  name_ja text,
  name_en text,
  gender text,
  graduation_year int,
  prefecture text,
  school_ja text,
  school_en text,
  result_count int,
  last_tournament_ja text,
  last_tournament_en text,
  last_date date,
  prefecture_match boolean,
  school_match boolean
)
language sql stable security definer set search_path = '' as $$
  with me as (
    select
      array_remove(array[
        private.norm_name(s.name_ja),
        private.norm_name(s.name_kana),
        private.norm_name(s.name_en),
        private.norm_name(concat(s.family_name_en, s.given_name_en))
      ], null) as names,
      private.norm_pref(s.prefecture) as pref,
      private.norm_school(s.school_name) as school
    from public.student_profiles s
    where s.user_id = student
      and (student = auth.uid() or private.is_guardian_of(student))
  ),
  candidates as (
    select
      p.*,
      sc.name_ja as school_ja,
      sc.name_en as school_en,
      nullif(sc.prefecture, '不明') as school_pref,
      private.norm_pref(coalesce(p.prefecture, sc.prefecture)) = me.pref as prefecture_match,
      (private.same_school(private.norm_school(sc.name_ja), me.school)
        or private.same_school(private.norm_school(sc.name_en), me.school)) as school_match
    from me
    join public.players p on (
      private.norm_name(p.name_ja) = any (me.names)
      or private.norm_name(p.name_kana) = any (me.names)
      or private.norm_name(p.name_en) = any (me.names)
    )
    left join public.schools sc on sc.id = p.school_id
  )
  select
    c.id,
    c.name_ja,
    c.name_en,
    c.gender,
    c.graduation_year,
    coalesce(c.prefecture, c.school_pref),
    c.school_ja,
    c.school_en,
    (select count(*)::int from public.tournament_results r where r.player_id = c.id),
    last.name_ja,
    last.name_en,
    last.start_date,
    coalesce(c.prefecture_match, false),
    coalesce(c.school_match, false)
  from candidates c
  left join lateral (
    select t.name_ja, t.name_en, t.start_date
    from public.tournament_results r
    join public.tournaments t on t.id = r.tournament_id
    where r.player_id = c.id
    order by t.start_date desc
    limit 1
  ) last on true
  where (c.prefecture_match or c.school_match)
    and not exists (select 1 from public.player_claims pc where pc.player_id = c.id and pc.student_id = student)
    and not exists (select 1 from public.student_player_dismissals d where d.player_id = c.id and d.student_id = student)
    and not exists (select 1 from public.player_claims pc where pc.player_id = c.id and pc.status = 'approved')
  order by coalesce(c.school_match, false)::int + coalesce(c.prefecture_match, false)::int desc, last.start_date desc nulls last;
$$;

revoke execute on function public.player_matches(uuid) from public, anon;
grant execute on function public.player_matches(uuid) to authenticated;

-- Signup also saves the country, prefecture / state, high school and address.
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
      birth_date, graduation_year, country, prefecture, school_name
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
      nullif(meta ->> 'graduation_year', '')::int,
      case when meta ->> 'country' ~ '^[A-Z]{2}$' then meta ->> 'country' end,
      nullif(meta ->> 'prefecture', ''),
      nullif(meta ->> 'school_name', '')
    );
    if nullif(meta ->> 'address_line', '') is not null or nullif(meta ->> 'postal_code', '') is not null then
      insert into student_addresses (student_id, postal_code, address_line)
      values (new.id, nullif(meta ->> 'postal_code', ''), nullif(meta ->> 'address_line', ''));
    end if;
  elsif chosen = 'coach' then
    insert into coach_profiles (user_id, college_name, title)
    values (new.id, meta ->> 'college_name', meta ->> 'title');
  end if;

  perform public.verify_edu_coach(new.id, new.email, new.email_confirmed_at);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
