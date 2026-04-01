-- Add index on wine_history.wine_id for faster lookups and joins
CREATE INDEX IF NOT EXISTS idx_wine_history_wine_id ON wine_history (wine_id);
