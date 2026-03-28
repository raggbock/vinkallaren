# Vinkällaren Mobile

En första riktig Expo-baserad mobilapp för iPhone och Android med Supabase för inloggning, databas och bildlagring.

## Det här finns redan

- Expo React Native-app i `App.tsx`
- Inloggning med e-post och lösenord via Supabase Auth
- Vinlista som läses från och sparas till Supabase
- Enkel statistik i appen
- Stöd för druvsort på varje vin
- Fält för Systembolaget artikelnummer som grund för framtida import
- Streckkodsskanning med kameran i mobilen
- Automatisk lokal förifyllning om samma streckkod redan finns i din källare
- Importförslag när streckkod eller Systembolaget artikelnummer matchar känd produktdata
- Importassistent där du själv väljer vilka fält som ska fyllas i
- Snabbval för `importera allt`, `bara tomma fält` eller `välj själv`
- Matmatchning per vin, till exempel `lamm`, `fisk`, `ost` eller `svamp`
- Automatiska matförslag baserat på vintyp
- En “Vad ska vi äta?”-vy som lyfter fram relevanta flaskor först
- Filter i källaren för att visa viner till en viss maträtt
- Filter på land, vintyp och fritextsökning
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
- `supabase/migrations/20260328093000_add_food_pairings.sql`
- `supabase/migrations/20260328101500_add_grape_column.sql`
- `supabase/migrations/20260328114000_add_systembolaget_reference.sql`
- `docs/backend-setup.md`
