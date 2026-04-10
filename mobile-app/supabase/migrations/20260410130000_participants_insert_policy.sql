-- Allow users to insert themselves as session participants
create policy "participants_insert" on session_participants
  for insert with check (user_id = auth.uid());
