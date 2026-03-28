# Vinkällaren Mobile

En första riktig Expo-baserad mobilapp för iPhone och Android med Supabase för inloggning, databas och bildlagring.

## Det här finns redan

- Expo React Native-app i `App.tsx`
- Inloggning med e-post och lösenord via Supabase Auth
- Vinlista som läses från och sparas till Supabase
- Enkel statistik i appen
- Bilduppladdning till Supabase Storage
- SQL-migration med row-level security i `supabase/migrations`

## Starta lokalt

1. Kopiera `.env.example` till `.env`
2. Fyll i:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Kör migrationen i Supabase
4. Starta appen:

```powershell
npm install
npm run web
```

För mobil:

```powershell
npm run android
npm run ios
```

## Viktiga filer

- `App.tsx`
- `src/lib/supabase.ts`
- `src/types/wine.ts`
- `supabase/migrations/20260327220500_init_wine_cellar.sql`
- `docs/backend-setup.md`
