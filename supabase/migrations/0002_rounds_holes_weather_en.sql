-- Rounds can be shortened to 9 holes (e.g. heat or weather), so scoring averages must know the length.
alter table rounds add column holes int not null default 18 check (holes in (9, 18));
-- English weather description, shown on the English site next to the Japanese original.
alter table rounds add column weather_en text;
