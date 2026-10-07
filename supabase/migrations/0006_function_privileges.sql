-- Close the API entry points the Supabase security advisor flagged on 0004_accounts.sql.

-- Trigger functions run when their trigger fires; nobody needs to call them through /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_confirmed() from public, anon, authenticated;

-- Fix the search path of the remaining trigger functions (they only use auth.* and pg_catalog).
alter function public.protect_account_columns() set search_path = '';
alter function public.force_pending() set search_path = '';

-- Policy helpers move out of the API schema. Policies refer to functions by id, so they keep
-- working; the roles a policy runs as still need usage and execute.
create schema if not exists private;
grant usage on schema private to anon, authenticated;
alter function public.is_verified_coach() set schema private;
alter function public.is_guardian_of(uuid) set schema private;
