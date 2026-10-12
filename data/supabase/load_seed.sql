-- src/data/seed.json の内容に本番 DB の成績データ (schools, players, courses, course_tees, tournaments,
-- tournament_results, rounds, player_rankings) をそろえる。seed.sql は大きすぎて SQL Editor に貼れないので、こちらを使う。
-- SQL Editor では2回に分けて流す (1回にまとめると取り消された。2026-10-12)。
--   1回目: create extension if not exists http with schema extensions;
--          create table public._seed_stage as select status, content
--            from extensions.http_get('https://raw.githubusercontent.com/ryusakane/athni/<commit>/src/data/seed.json');
--   2回目: begin; create temp table seed_src on commit drop as
--            select content::jsonb as j from public._seed_stage where status = 200;
--          (このファイル) commit; drop table public._seed_stage;
-- 2026-10-12 に使った実物は /mnt/project-files/past-results/step1_fetch.sql と step2_load.sql。
--
-- 1. seed にない行を消す。消える選手・成績に生徒の申請などが付いていたら止まる (名寄せで id が変わったため。
--    付け替えてから流し直す)。
-- 2. seed の行を id で upsert する。
-- 最後に件数を返す。seed.json の件数と同じなら成功。

do $$
declare
  refs int;
begin
  select count(*) into refs from (
    select player_id from player_claims
    union all select player_id from coach_saved_players
    union all select player_id from student_player_dismissals
  ) x
  where player_id not in (select (e->>'id')::uuid from seed_src, jsonb_array_elements(j->'players') e);
  if refs > 0 then
    raise exception '% account rows point at players that this load would delete', refs;
  end if;
  select count(*) into refs from student_hidden_results
  where result_id not in (select (e->>'id')::uuid from seed_src, jsonb_array_elements(j->'tournament_results') e);
  if refs > 0 then
    raise exception '% hidden results point at results that this load would delete', refs;
  end if;
end $$;

create temp table seed_ids on commit drop as
select t.name as tbl, (e->>'id')::uuid as id
from seed_src, (values ('schools'), ('players'), ('courses'), ('course_tees'), ('tournaments'),
                       ('tournament_results'), ('rounds'), ('player_rankings')) t(name),
     jsonb_array_elements(j->t.name) e;
create index on seed_ids (tbl, id);

delete from player_rankings x where not exists (select 1 from seed_ids s where s.tbl = 'player_rankings' and s.id = x.id);
delete from rounds x where not exists (select 1 from seed_ids s where s.tbl = 'rounds' and s.id = x.id);
delete from tournament_results x where not exists (select 1 from seed_ids s where s.tbl = 'tournament_results' and s.id = x.id);
delete from tournaments x where not exists (select 1 from seed_ids s where s.tbl = 'tournaments' and s.id = x.id);
delete from players x where not exists (select 1 from seed_ids s where s.tbl = 'players' and s.id = x.id);
delete from course_tees x where not exists (select 1 from seed_ids s where s.tbl = 'course_tees' and s.id = x.id);
delete from courses x where not exists (select 1 from seed_ids s where s.tbl = 'courses' and s.id = x.id);
delete from schools x where not exists (select 1 from seed_ids s where s.tbl = 'schools' and s.id = x.id);

insert into schools (id, name_ja, name_en, prefecture)
select id, name_ja, name_en, prefecture
from seed_src, jsonb_to_recordset(j->'schools') as r(id uuid, name_ja text, name_en text, prefecture text)
on conflict (id) do update set name_ja = excluded.name_ja, name_en = excluded.name_en, prefecture = excluded.prefecture;

insert into courses (id, name_ja, name_en, prefecture, latitude, longitude)
select id, name_ja, name_en, prefecture, latitude, longitude
from seed_src, jsonb_to_recordset(j->'courses')
  as r(id uuid, name_ja text, name_en text, prefecture text, latitude numeric, longitude numeric)
on conflict (id) do update set name_ja = excluded.name_ja, name_en = excluded.name_en,
  prefecture = excluded.prefecture, latitude = excluded.latitude, longitude = excluded.longitude;

insert into course_tees (id, course_id, tee_name, gender, par, yardage, course_rating, slope_rating)
select id, course_id, tee_name, gender, par, yardage, course_rating, slope_rating
from seed_src, jsonb_to_recordset(j->'course_tees')
  as r(id uuid, course_id uuid, tee_name text, gender text, par int, yardage int, course_rating numeric, slope_rating int)
on conflict (id) do update set course_id = excluded.course_id, tee_name = excluded.tee_name, gender = excluded.gender,
  par = excluded.par, yardage = excluded.yardage, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating;

insert into players (id, school_id, name_ja, name_kana, name_en, gender, graduation_year, prefecture)
select id, school_id, name_ja, name_kana, name_en, gender, graduation_year, prefecture
from seed_src, jsonb_to_recordset(j->'players')
  as r(id uuid, school_id uuid, name_ja text, name_kana text, name_en text, gender text, graduation_year int, prefecture text)
on conflict (id) do update set school_id = excluded.school_id, name_ja = excluded.name_ja, name_kana = excluded.name_kana,
  name_en = excluded.name_en, gender = excluded.gender, graduation_year = excluded.graduation_year,
  prefecture = excluded.prefecture;

insert into tournaments (id, name_ja, name_en, organizer, level, gender, course_id, start_date, end_date, field_size,
                         winning_score, source_url)
select id, name_ja, name_en, organizer, level, gender, course_id, start_date, end_date, field_size, winning_score, source_url
from seed_src, jsonb_to_recordset(j->'tournaments')
  as r(id uuid, name_ja text, name_en text, organizer text, level text, gender text, course_id uuid, start_date date,
       end_date date, field_size int, winning_score int, source_url text)
on conflict (id) do update set name_ja = excluded.name_ja, name_en = excluded.name_en, organizer = excluded.organizer,
  level = excluded.level, gender = excluded.gender, course_id = excluded.course_id, start_date = excluded.start_date,
  end_date = excluded.end_date, field_size = excluded.field_size, winning_score = excluded.winning_score,
  source_url = excluded.source_url;

insert into tournament_results (id, tournament_id, player_id, position, tied, total_score, to_par, rank_percentile, status,
                                source, note)
select id, tournament_id, player_id, position, tied, total_score, to_par, rank_percentile, status, source, note
from seed_src, jsonb_to_recordset(j->'tournament_results')
  as r(id uuid, tournament_id uuid, player_id uuid, position int, tied boolean, total_score int, to_par int,
       rank_percentile numeric, status text, source text, note text)
on conflict (id) do update set tournament_id = excluded.tournament_id, player_id = excluded.player_id,
  position = excluded.position, tied = excluded.tied, total_score = excluded.total_score, to_par = excluded.to_par,
  rank_percentile = excluded.rank_percentile, status = excluded.status, source = excluded.source,
  note = excluded.note;

insert into rounds (id, result_id, round_number, played_on, course_tee_id, score, holes, score_differential, weather,
                    weather_en, temperature_c, wind_speed_ms, precipitation_mm)
select id, result_id, round_number, played_on, course_tee_id, score, holes, score_differential, weather, weather_en,
       temperature_c, wind_speed_ms, precipitation_mm
from seed_src, jsonb_to_recordset(j->'rounds')
  as r(id uuid, result_id uuid, round_number int, played_on date, course_tee_id uuid, score int, holes int,
       score_differential numeric, weather text, weather_en text, temperature_c numeric, wind_speed_ms numeric,
       precipitation_mm numeric)
on conflict (id) do update set result_id = excluded.result_id, round_number = excluded.round_number,
  played_on = excluded.played_on, course_tee_id = excluded.course_tee_id, score = excluded.score, holes = excluded.holes,
  score_differential = excluded.score_differential, weather = excluded.weather, weather_en = excluded.weather_en,
  temperature_c = excluded.temperature_c, wind_speed_ms = excluded.wind_speed_ms,
  precipitation_mm = excluded.precipitation_mm;

insert into player_rankings (id, player_id, system, category, rank, points, as_of, source_url)
select id, player_id, system, category, rank, points, as_of, source_url
from seed_src, jsonb_to_recordset(j->'player_rankings')
  as r(id uuid, player_id uuid, system text, category text, rank int, points numeric, as_of date, source_url text)
on conflict (id) do update set player_id = excluded.player_id, system = excluded.system, category = excluded.category,
  rank = excluded.rank, points = excluded.points, as_of = excluded.as_of, source_url = excluded.source_url;

select (select count(*) from schools) as schools, (select count(*) from players) as players,
       (select count(*) from courses) as courses, (select count(*) from course_tees) as course_tees,
       (select count(*) from tournaments) as tournaments, (select count(*) from tournament_results) as results,
       (select count(*) from rounds) as rounds, (select count(*) from player_rankings) as rankings;
