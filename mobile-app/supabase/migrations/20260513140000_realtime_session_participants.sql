-- Add session_participants to the realtime publication so the host (and other
-- participants) can see joins/leaves live without polling.
alter publication supabase_realtime add table session_participants;
