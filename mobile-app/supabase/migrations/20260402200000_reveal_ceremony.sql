-- Add revealed_up_to column
ALTER TABLE tasting_sessions ADD COLUMN revealed_up_to INTEGER NOT NULL DEFAULT 0;

-- Migrate any existing 'revealed' sessions to 'ended'
UPDATE tasting_sessions SET status = 'ended' WHERE status = 'revealed';

-- Replace status CHECK constraint: revealed → revealing
ALTER TABLE tasting_sessions DROP CONSTRAINT tasting_sessions_status_check;
ALTER TABLE tasting_sessions ADD CONSTRAINT tasting_sessions_status_check
  CHECK (status IN ('active', 'revealing', 'ended'));

-- Update RLS: during 'revealing', show others' tastings only for revealed wines
DROP POLICY session_tastings_select_others ON session_tastings;
CREATE POLICY session_tastings_select_others ON session_tastings FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasting_sessions ts
    WHERE ts.id = session_tastings.session_id
    AND (
      ts.mode = 'open'
      OR ts.status = 'ended'
      OR ts.host_id = auth.uid()
      OR (ts.status = 'revealing' AND EXISTS (
        SELECT 1 FROM session_wines sw
        WHERE sw.id = session_tastings.session_wine_id
        AND sw.position <= ts.revealed_up_to
      ))
    )
  )
);
