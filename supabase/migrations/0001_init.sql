-- Initial schema for Athni: Japanese high school golfers, tournaments and results.
-- Names are stored in both Japanese and English so the site can present data to US college coaches.

create table schools (
  id uuid primary key default gen_random_uuid(),
  name_ja text not null,
  name_en text,
  prefecture text not null,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools (id),
  name_ja text not null,
  name_kana text,
  name_en text,
  gender text not null check (gender in ('male', 'female')),
  graduation_year int,
  prefecture text,
  created_at timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  name_ja text not null,
  name_en text,
  prefecture text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

-- Course rating and slope vary by tee and gender.
create table course_tees (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  tee_name text not null,
  gender text not null check (gender in ('male', 'female')),
  par int not null,
  yardage int,
  course_rating numeric(4, 1),
  slope_rating int check (slope_rating between 55 and 155),
  unique (course_id, tee_name, gender)
);

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name_ja text not null,
  name_en text,
  organizer text,
  level text, -- e.g. national, regional (block), prefectural
  gender text check (gender in ('male', 'female', 'mixed')),
  course_id uuid references courses (id),
  start_date date not null,
  end_date date,
  field_size int,
  winning_score int,
  cut_score int,
  source_url text,
  created_at timestamptz not null default now()
);

-- Final standing of a player in a tournament.
create table tournament_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  position int,
  tied boolean not null default false,
  total_score int,
  to_par int,
  rank_percentile numeric(5, 2),
  status text not null default 'finished' check (status in ('finished', 'cut', 'wd', 'dq')),
  unique (tournament_id, player_id)
);

-- Per-round score with the tee played and conditions on the day.
create table rounds (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references tournament_results (id) on delete cascade,
  round_number int not null,
  played_on date,
  course_tee_id uuid references course_tees (id),
  score int,
  -- (113 / slope) * (score - course rating), comparable across courses.
  score_differential numeric(4, 1),
  weather text,
  temperature_c numeric(4, 1),
  wind_speed_ms numeric(4, 1),
  precipitation_mm numeric(5, 1),
  unique (result_id, round_number)
);

-- Player-entered profile data (handicap, WAGR, GPA, test scores, video, etc.)
-- will live in a separate table shown only with parent consent; not built yet.

alter table schools enable row level security;
alter table players enable row level security;
alter table courses enable row level security;
alter table course_tees enable row level security;
alter table tournaments enable row level security;
alter table tournament_results enable row level security;
alter table rounds enable row level security;

-- Public read access; writes go through the service role only.
create policy "public read" on schools for select using (true);
create policy "public read" on players for select using (true);
create policy "public read" on courses for select using (true);
create policy "public read" on course_tees for select using (true);
create policy "public read" on tournaments for select using (true);
create policy "public read" on tournament_results for select using (true);
create policy "public read" on rounds for select using (true);
