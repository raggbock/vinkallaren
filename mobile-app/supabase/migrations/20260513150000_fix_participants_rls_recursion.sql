-- Realtime's RLS evaluator surfaces "infinite recursion detected" because the
-- old participants_select policy queries session_participants from itself.
-- Use the existing SECURITY DEFINER helper, which bypasses RLS on the inner
-- query, exactly like the sister tables' policies already do.
drop policy if exists participants_select on session_participants;

create policy participants_select on session_participants
  for select
  using (is_session_participant(session_id));
