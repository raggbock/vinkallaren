-- Drop redundant RLS policy (profiles_update_own already covers this)
DROP POLICY IF EXISTS profiles_update_visibility ON profiles;

-- Add storage policy for public wine images
CREATE POLICY wine_images_select_public ON storage.objects
  FOR SELECT USING (
    bucket_id = 'wine-images'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id::text = split_part(name, '/', 1)
        AND profiles.is_public = true
        AND profiles.show_wines = true
    )
  );
