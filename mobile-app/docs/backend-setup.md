# Backend Setup

This Expo app is designed to use Supabase for authentication, database storage, and wine photo storage.

## What This Starter Includes

- A `profiles` table linked to `auth.users`
- A `wines` table for cellar inventory
- Grape field support for richer filtering and future imports
- Systembolaget product reference support for future enrichment/import
- Food pairing metadata on each wine for meal-based browsing
- Row-level security policies so each user only sees their own data
- A private `wine-images` storage bucket for bottle photos

## Local Environment Variables

Copy `.env.example` to `.env` and fill in the values from your Supabase project.

Only the public client values should go into the Expo app:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Do not put your service role key in the mobile app.

## Applying The Database

Run the SQL migrations in:

- `supabase/migrations/20260327220500_init_wine_cellar.sql`
- `supabase/migrations/20260328093000_add_food_pairings.sql`
- `supabase/migrations/20260328101500_add_grape_column.sql`
- `supabase/migrations/20260328114000_add_systembolaget_reference.sql`

Use the Supabase SQL editor or the Supabase CLI.

## Storage Convention

Store wine images in the `wine-images` bucket using a path like:

`<user-id>/<wine-id>/<filename>`

That keeps the storage policies simple and makes it easy to scope access to the signed-in user.

## Next App Steps

- Import pairing hints from trusted sources when a wine matches by barcode or product identity
- Prefer Systembolaget product data where available
- Treat Vivino as optional enrichment only after confirming an acceptable integration path
