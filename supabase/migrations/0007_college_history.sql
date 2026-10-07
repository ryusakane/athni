-- Past seasons (from the athletics sites' past-season rosters), majors, and official tour profile links.

alter table college_roster_players add column if not exists major text;
-- [{"tour": "PGA Tour", "url": "https://www.pgatour.com/player/46442"}, ...] (links only; results are not stored)
alter table college_alumni_pros add column if not exists tour_links jsonb not null default '[]';

-- Players on a past roster who are no longer on the team.
create table if not exists college_former_players (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references college_programs(id) on delete cascade,
  name text not null,
  seasons text[] not null default '{}',   -- e.g. {'2016-17', '2017-18'}
  class_year text check (class_year in ('FR', 'SO', 'JR', 'SR', 'GR')),  -- class in the last season listed
  major text,
  hometown text,
  country text,
  previous_school text,
  profile_url text,
  source_url text,
  -- estimated from the rosters: graduated (last listed as SR/GR), transferred (later on another D1 roster), left
  career_status text not null check (career_status in ('graduated', 'transferred', 'left')),
  transferred_to text,                    -- colleges.slug
  tour_links jsonb not null default '[]'
);

-- Coaches on a past roster who are no longer on the staff.
create table if not exists college_past_coaches (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references college_programs(id) on delete cascade,
  name text not null,
  title text,
  seasons text[] not null default '{}',
  sort_order int not null default 0,
  profile_url text,
  source_url text
);

create index if not exists college_former_players_program_id_idx on college_former_players (program_id);
create index if not exists college_past_coaches_program_id_idx on college_past_coaches (program_id);

alter table college_former_players enable row level security;
alter table college_past_coaches enable row level security;
create policy "public read" on college_former_players for select using (true);
create policy "public read" on college_past_coaches for select using (true);
