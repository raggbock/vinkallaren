# Backend Setup

This Expo app is designed to use Supabase for authentication, database storage, and wine photo storage.

## What This Starter Includes

- A `profiles` table linked to `auth.users`
- A `wines` table for cellar inventory
- Row-level security policies so each user only sees their own data
- A private `wine-images` storage bucket for bottle photos

## Local Environment Variables

Copy `.env.example` to `.env` and fill in the values from your Supabase project.

Only the public client values should go into the Expo app:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Do not put your service role key in the mobile app.

## Applying The Database

Run the SQL migration in `supabase/migrations/20260327220500_init_wine_cellar.sql` from the Supabase SQL editor or via the Supabase CLI.

## Storage Convention

Store wine images in the `wine-images` bucket using a path like:

`<user-id>/<wine-id>/<filename>`

That keeps the storage policies simple and makes it easy to scope access to the signed-in user.

## Next App Steps

- Add the Supabase client to the Expo app
- Implement sign up, sign in, and sign out screens
- Load the signed-in user's wines from the database
- Upload selected bottle images to the private storage bucket
