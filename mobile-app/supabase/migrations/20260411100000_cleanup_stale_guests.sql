-- Cleanup anonymous guest accounts older than 30 days
-- Cascade delete removes all associated data (wines, history, tastings, etc.)
create or replace function public.cleanup_stale_guests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from auth.users
  where is_anonymous = true
    and last_sign_in_at < now() - interval '30 days'
  ;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Only service_role can call this (not anon or authenticated users)
revoke execute on function public.cleanup_stale_guests() from anon, authenticated;
