-- New visibility columns on profiles
ALTER TABLE profiles
  ADD COLUMN is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN show_wines boolean NOT NULL DEFAULT false,
  ADD COLUMN show_taste_profile boolean NOT NULL DEFAULT false,
  ADD COLUMN cellar_code text UNIQUE;

-- Index for cellar code lookups
CREATE INDEX idx_profiles_cellar_code ON profiles (cellar_code) WHERE cellar_code IS NOT NULL;

-- Function to generate unique 6-char cellar code
CREATE OR REPLACE FUNCTION generate_cellar_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  code_exists boolean;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE cellar_code = code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN code;
END;
$$;

-- RPC: get cellar summary for a public user
CREATE OR REPLACE FUNCTION get_cellar_summary(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  target_is_public boolean;
BEGIN
  -- Check caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check target is public
  SELECT is_public INTO target_is_public
  FROM profiles WHERE id = target_user_id;

  IF target_is_public IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'total_bottles', COALESCE(SUM(w.quantity), 0),
    'unique_labels', COUNT(DISTINCT w.name),
    'top_country', (
      SELECT w2.country FROM wines w2
      WHERE w2.user_id = target_user_id AND w2.country IS NOT NULL
      GROUP BY w2.country ORDER BY SUM(w2.quantity) DESC LIMIT 1
    ),
    'top_type', (
      SELECT w2.type FROM wines w2
      WHERE w2.user_id = target_user_id
      GROUP BY w2.type ORDER BY SUM(w2.quantity) DESC LIMIT 1
    ),
    'top_grape', (
      SELECT w2.grape FROM wines w2
      WHERE w2.user_id = target_user_id AND w2.grape IS NOT NULL
      GROUP BY w2.grape ORDER BY SUM(w2.quantity) DESC LIMIT 1
    ),
    'avg_vintage', (
      SELECT ROUND(AVG(w2.vintage)) FROM wines w2
      WHERE w2.user_id = target_user_id AND w2.vintage IS NOT NULL
    ),
    'type_distribution', (
      SELECT jsonb_object_agg(type, cnt)
      FROM (
        SELECT w2.type, SUM(w2.quantity) as cnt
        FROM wines w2
        WHERE w2.user_id = target_user_id
        GROUP BY w2.type
      ) sub
    )
  ) INTO result
  FROM wines w
  WHERE w.user_id = target_user_id;

  RETURN result;
END;
$$;

-- RLS policy: allow reading wines of public users who show wines
CREATE POLICY wines_select_public ON wines
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND user_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = wines.user_id
        AND profiles.is_public = true
        AND profiles.show_wines = true
    )
  );

-- Allow users to update their own visibility settings
CREATE POLICY profiles_update_visibility ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
