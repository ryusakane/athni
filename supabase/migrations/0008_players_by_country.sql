-- Players on the team since 2016-17 (current roster + former players), counted by home country.
-- e.g. {"US": 31, "JP": 2, "KR": 1}. The site shows one country (Japan for now); the rest is kept as data.
alter table college_programs add column if not exists players_by_country jsonb not null default '{}';
