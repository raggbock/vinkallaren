-- Add 'setup' to session status options
ALTER TABLE tasting_sessions DROP CONSTRAINT tasting_sessions_status_check;
ALTER TABLE tasting_sessions ADD CONSTRAINT tasting_sessions_status_check
  CHECK (status IN ('setup', 'active', 'revealing', 'ended'));

-- Change default status to 'setup'
ALTER TABLE tasting_sessions ALTER COLUMN status SET DEFAULT 'setup';
