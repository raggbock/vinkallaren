-- join_session_by_code must run as definer so a brand-new anon participant
-- can look the session up by code before sessions_select RLS would let
-- them see the row. The previous version was security definer; my last
-- rewrite accidentally dropped that.
create or replace function join_session_by_code(code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sess record;
begin
  select id, title, host_id, join_code, mode, format, free_order, status, created_at
  into sess
  from tasting_sessions
  where join_code = upper(code) and status in ('setup', 'active');

  if not found then
    return json_build_object('error', 'Session not found or not active');
  end if;

  insert into session_participants (session_id, user_id)
  values (sess.id, auth.uid())
  on conflict do nothing;

  return json_build_object(
    'id', sess.id,
    'title', sess.title,
    'host_id', sess.host_id,
    'join_code', sess.join_code,
    'mode', sess.mode,
    'format', sess.format,
    'free_order', sess.free_order,
    'status', sess.status,
    'created_at', sess.created_at,
    'overview', get_session_overview(sess.id)
  );
end;
$$;
