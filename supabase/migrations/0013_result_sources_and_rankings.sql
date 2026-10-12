-- Results that only the player's own record shows, and amateur rankings on player profiles.

-- source: 'public' = a published result (tournaments.source_url); 'self_reported' = no public result
-- was found and the row comes from the player's own record (resume etc.). Self-reported rows are
-- shown with a label and left out of the computed stats.
-- note: a short label for results that are not a stroke-play finish (e.g. "Round of 64").
alter table tournament_results
  add column source text not null default 'public' check (source in ('public', 'self_reported')),
  add column note text;

-- A player's position in an amateur ranking (WAGR, JGA, ...) on a given date.
create table player_rankings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id) on delete cascade,
  system text not null,
  category text,
  rank int not null check (rank > 0),
  points numeric,
  as_of date not null,
  source_url text
);

create index player_rankings_player on player_rankings (player_id);

alter table player_rankings enable row level security;
create policy "public read" on player_rankings for select using (true);
