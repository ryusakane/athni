-- Identity checks (decided by ryu, 2026-10-07).
-- * A coach is verified automatically only when their confirmed email is on a college's
--   published coaching staff list (college_coaches). A .edu address alone is not enough:
--   college students and other college staff have one too. Everyone else waits for staff.
-- * Assistants and other staff of a verified coach use their own account. The coach invites
--   them by email on the same college domain. Shared logins and outside recruiting agents
--   are not allowed.
-- * A results claim can carry a link that shows the result is the student's; coaches see
--   which results our staff confirmed.
-- * A student can unlink a parent and change their parent invite code.
-- No document checks for students or parents: they differ by country and we would have to
-- store them.

alter table coach_profiles
  add column verification_method text
    check (verification_method in ('staff_list', 'staff_review', 'team_invite')),
  add column college_coach_id uuid references college_coaches (id) on delete set null,
  -- Set for staff a verified coach invited. Null for coaches verified on their own.
  add column invited_by uuid references coach_profiles (user_id) on delete set null;

-- Staff a verified coach has invited, by email. accepted_by is set once that account is verified.
create table coach_team_invites (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coach_profiles (user_id) on delete cascade,
  email text not null check (email = lower(email)),
  accepted_by uuid references coach_profiles (user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (coach_id, email)
);

alter table coach_team_invites enable row level security;
create policy "own team invites" on coach_team_invites for select using (coach_id = auth.uid());
create policy "remove own team invite" on coach_team_invites for delete using (coach_id = auth.uid());

alter table player_claims add column evidence_url text;

-- A staff member counts only while the coach who invited them is still verified.
create or replace function private.is_verified_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from coach_profiles c
    where c.user_id = auth.uid()
      and c.verification_status = 'verified'
      and (c.invited_by is null or exists (
        select 1 from coach_profiles lead
        where lead.user_id = c.invited_by
          and lead.verification_status = 'verified'
          and lead.invited_by is null))
  );
$$;

-- Called by the signup and email-confirmed triggers (the name is kept from 0004).
-- 1. Confirmed email on the published staff list → verified.
-- 2. Confirmed email invited by a verified coach → verified as their staff.
-- Otherwise the account stays pending for staff review.
create or replace function public.verify_edu_coach(uid uuid, email text, confirmed_at timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
declare
  listed uuid;
  invite coach_team_invites;
begin
  if $3 is null or not exists (
    select 1 from coach_profiles where user_id = $1 and verification_status = 'pending'
  ) then
    return;
  end if;

  select id into listed from college_coaches where lower(college_coaches.email) = lower($2) limit 1;
  if listed is not null then
    update coach_profiles
    set verification_status = 'verified', verified_at = now(),
        verification_method = 'staff_list', college_coach_id = listed
    where user_id = $1;
    return;
  end if;

  select i.* into invite
  from coach_team_invites i
  join coach_profiles lead on lead.user_id = i.coach_id
  where i.email = lower($2)
    and i.accepted_by is null
    and i.coach_id <> $1
    and lead.verification_status = 'verified'
    and lead.invited_by is null
  order by i.created_at
  limit 1;
  if found then
    update coach_profiles
    set verification_status = 'verified', verified_at = now(),
        verification_method = 'team_invite', invited_by = invite.coach_id
    where user_id = $1;
    update coach_team_invites set accepted_by = $1 where id = invite.id;
  end if;
end;
$$;

-- A verified coach (not an invited staff member) invites a staff member on their own domain.
create function public.invite_team_member(member_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  addr text := lower(trim(member_email));
  my_domain text;
  member uuid;
  member_confirmed timestamptz;
begin
  if not exists (
    select 1 from coach_profiles
    where user_id = auth.uid() and verification_status = 'verified' and invited_by is null
  ) then
    raise exception 'only a verified coach can invite staff';
  end if;
  select split_part(lower(email), '@', 2) into my_domain from auth.users where id = auth.uid();
  if my_domain in ('gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'me.com', 'aol.com') then
    raise exception 'staff can only be invited from a college email address';
  end if;
  if split_part(addr, '@', 2) <> my_domain then
    raise exception 'staff must use an email on %', my_domain;
  end if;

  insert into coach_team_invites (coach_id, email) values (auth.uid(), addr) on conflict do nothing;

  -- The staff member may already have an account.
  select id, email_confirmed_at into member, member_confirmed from auth.users where lower(email) = addr;
  if member is not null then
    perform public.verify_edu_coach(member, addr, member_confirmed);
  end if;
end;
$$;

-- Removing an invite removes that staff member's access.
create function public.handle_team_invite_removed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.accepted_by is not null then
    update coach_profiles
    set verification_status = 'pending', verified_at = null, verification_method = null, invited_by = null
    where user_id = old.accepted_by and invited_by = old.coach_id;
  end if;
  return old;
end;
$$;

create trigger on_team_invite_removed after delete on coach_team_invites
  for each row execute function public.handle_team_invite_removed();

-- A student gets a new parent invite code, e.g. when the old one was shared by mistake.
create function public.rotate_parent_invite_code() returns text
language plpgsql security definer set search_path = public as $$
declare
  code text := upper(substr(md5(gen_random_uuid()::text), 1, 8));
begin
  update student_profiles set parent_invite_code = code where user_id = auth.uid();
  if not found then
    raise exception 'only students have an invite code';
  end if;
  return code;
end;
$$;

-- A student can remove a linked parent.
create policy "student unlinks" on guardian_links for delete using (student_id = auth.uid());

-- Users may not change verification, invite codes or review status themselves.
create or replace function public.protect_account_columns() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_table_name = 'profiles' then
    new.role := old.role;
  elsif tg_table_name = 'student_profiles' then
    new.parent_invite_code := old.parent_invite_code;
    new.updated_at := now();
  elsif tg_table_name in ('player_claims', 'result_requests') then
    new.status := old.status;
    new.reviewer_note := old.reviewer_note;
    new.reviewed_at := old.reviewed_at;
    new.student_id := old.student_id;
  elsif tg_table_name = 'coach_profiles' then
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.verification_method := old.verification_method;
    new.college_coach_id := old.college_coach_id;
    new.invited_by := old.invited_by;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_team_invite_removed() from public, anon, authenticated;
revoke execute on function public.invite_team_member(text) from public, anon;
grant execute on function public.invite_team_member(text) to authenticated;
revoke execute on function public.rotate_parent_invite_code() from public, anon;
grant execute on function public.rotate_parent_invite_code() to authenticated;
