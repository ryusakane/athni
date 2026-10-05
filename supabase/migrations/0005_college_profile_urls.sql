-- Link each coach and roster player to their own profile page on the college athletics site.
alter table college_coaches add column if not exists profile_url text;
alter table college_roster_players add column if not exists profile_url text;
