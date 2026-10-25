-- "This is me" with a list of the record's tournaments.
--   After a student says a matched results record is them, the account page lists that
--   record's tournaments, all ticked. The student unticks any that are not theirs (a record
--   merged with someone of the same name) and sends the rest as one claim. The unticked
--   results are hidden on the student's profile like × (0012_hidden_results.sql) and marked
--   so staff check the record for a wrong merge. The results data itself is not changed.

-- Where a hidden result came from: × on the profile, or unticked when claiming.
alter table student_hidden_results add column source text not null default 'profile'
  check (source in ('profile', 'claim'));

-- The claim and the unticked results are saved together. Runs as the caller, so the usual
-- policies apply (the student or a linked parent). Only results of that record are hidden.
create function public.claim_player(student uuid, player uuid, excluded uuid[] default '{}')
returns void
language plpgsql set search_path = '' as $$
begin
  insert into public.player_claims (student_id, player_id, source)
  values (student, player, 'profile_match');

  insert into public.student_hidden_results (student_id, result_id, source)
  select student, r.id, 'claim'
  from public.tournament_results r
  where r.player_id = player and r.id = any (coalesce(excluded, '{}'))
  on conflict (student_id, result_id) do nothing;
end;
$$;

revoke execute on function public.claim_player(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.claim_player(uuid, uuid, uuid[]) to authenticated;
