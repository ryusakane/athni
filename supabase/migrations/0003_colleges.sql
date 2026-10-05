-- US college golf programs, for players looking at where to go next.
-- One row per institution; men's and women's teams are separate programs under it.

create table colleges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,           -- URL key, e.g. 'stanford'
  name_en text not null,               -- official name, e.g. 'Stanford University'
  name_ja text,                        -- katakana/Japanese name where one is in common use
  short_name text,                     -- name used in results and rankings, e.g. 'Stanford'
  nickname text,                       -- e.g. 'Cardinal'
  division text not null check (division in ('D1', 'D2', 'D3', 'NAIA', 'NJCAA')),
  conference text,
  city text,
  state text,                          -- USPS code, e.g. 'CA'
  website_url text,
  athletics_url text,
  updated_at timestamptz not null default now()
);

create table college_programs (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges(id) on delete cascade,
  gender text not null check (gender in ('male', 'female')),
  golf_url text,
  roster_url text,
  coaches_url text,
  instagram_url text,
  x_url text,
  facebook_url text,
  tiktok_url text,
  youtube_url text,
  roster_season text,                  -- e.g. '2026-27'
  roster_source_url text,
  collected_at date,
  unique (college_id, gender)
);

-- Team rankings are kept per source and date, since several publish them (Clippd Scoreboard, Golfweek, Golf Channel...).
create table college_rankings (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references college_programs(id) on delete cascade,
  source text not null,
  rank int not null,
  as_of date not null,
  source_url text,
  unique (program_id, source, as_of)
);

-- Only what the school itself publishes on its official athletics site.
create table college_coaches (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references college_programs(id) on delete cascade,
  name text not null,
  title text,
  email text,
  phone text,
  sort_order int not null default 0,
  source_url text
);

create table college_roster_players (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references college_programs(id) on delete cascade,
  name text not null,
  class_year text check (class_year in ('FR', 'SO', 'JR', 'SR', 'GR')),
  redshirt boolean not null default false,
  hometown text,
  country text,                        -- ISO 3166-1 alpha-2, from the hometown line
  previous_school text
);

-- Former players who turned professional.
create table college_alumni_pros (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges(id) on delete cascade,
  gender text not null check (gender in ('male', 'female')),
  name text not null,
  tours text[] not null default '{}',  -- e.g. {'PGA Tour', 'Korn Ferry Tour'}
  final_college_year int,
  country text,
  source_url text
);

create index on college_programs (college_id);
create index on college_rankings (program_id);
create index on college_coaches (program_id);
create index on college_roster_players (program_id);
create index on college_alumni_pros (college_id);

alter table colleges enable row level security;
alter table college_programs enable row level security;
alter table college_rankings enable row level security;
alter table college_coaches enable row level security;
alter table college_roster_players enable row level security;
alter table college_alumni_pros enable row level security;

create policy "public read" on colleges for select using (true);
create policy "public read" on college_programs for select using (true);
create policy "public read" on college_rankings for select using (true);
create policy "public read" on college_coaches for select using (true);
create policy "public read" on college_roster_players for select using (true);
create policy "public read" on college_alumni_pros for select using (true);
