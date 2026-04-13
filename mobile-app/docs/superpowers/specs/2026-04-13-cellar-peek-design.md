# Titta in — Besök andras vinkällare

## Syfte

Låta användare dela sin vinkällare med andra och "titta in" i andras källare. Användare styr själva hur mycket som visas via synlighetsinställningar.

## Privatmodell

- **Allt stängt som default** — ingen data exponeras förrän användaren aktivt väljer det
- Tre oberoende toggles i profilinställningar:

| Inställning | Default | Effekt |
|---|---|---|
| `is_public` | false | Profilen synlig för andra (sammanfattning via Översikt-fliken) |
| `show_wines` | false | Vinlistan synlig (kräver `is_public`) |
| `show_taste_profile` | false | Smakprofilen synlig (kräver `is_public`) |

## Hitta en källare

### Källarkod

- 6 tecken, alfanumeriskt, versaler (t.ex. `VINK42`)
- Genereras av en DB-funktion när användaren slår på `is_public` första gången
- Sparas i `profiles.cellar_code` (unique)
- Kan regenereras av ägaren (invaliderar den gamla)
- Ger ingen extra access — bara en genväg till profilen

### Ingångspunkt

- Person/sök-ikon i appens header (alltid synlig, oavsett aktiv tabb)
- Öppnar `cellar-lookup-modal` med:
  1. Textinput för källarkod + sök-knapp
  2. Lista med senast besökta profiler (AsyncStorage, max 10)

### Framtida utbyggnad (ej i scope)

- Sökfunktion på display_name
- Vänner/följare-system med aktivitets-feed ("vän har startat en provning")

## Källarvy — publik profilsida

Tabbad layout med header + flikar. Dolda flikar visas inte alls (inte låsta — de existerar inte i UI).

### Header

- Avatar (cirkel med initialer + avatar_color)
- Display name
- Källarkod
- Antal flaskor (alltid synligt om `is_public`)

### Flikar

#### Översikt (synlig om `is_public`)

Sammanfattningsdata via `get_cellar_summary()` RPC:

- Antal flaskor, antal unika etiketter
- Topp-land, vanligaste typ, topp-druva, snitt-årgång
- Typfördelning (rött/vitt/rosé/bubbel) som stapel

#### Viner (synlig om `show_wines`)

Readonly vinlista med filtrering (land, typ, druva, årgång).

Exponerade fält per vin:
- `name`, `producer`, `vintage`, `country`, `region`, `grape`, `type`, `food_pairings`, `image_path`

Dolda fält (aldrig exponerade):
- `quantity`, `storage_space_id`, `notes`, `acquired_at`, `drink_by_year`

#### Smakprofil (synlig om `show_taste_profile`)

Återanvänder befintliga `taste-profile.tsx` med target user's data:
- Antal provningar, viner provade, senaste provning
- WSET-preferenser
- Topp-regioner & druvor

## Datamodell

### Nya kolumner på `profiles`

```sql
ALTER TABLE profiles
  ADD COLUMN is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN show_wines boolean NOT NULL DEFAULT false,
  ADD COLUMN show_taste_profile boolean NOT NULL DEFAULT false,
  ADD COLUMN cellar_code text UNIQUE;
```

### RPC: `get_cellar_summary(target_user_id uuid)`

Returnerar aggregerad data för en publik användare utan att exponera enskilda viner.

Kräver:
- Anroparen är autentiserad
- Target user har `is_public = true`

Returnerar:
- `total_bottles` (SUM quantity)
- `unique_labels` (COUNT DISTINCT name)
- `top_country`, `top_type`, `top_grape`
- `avg_vintage`
- `type_distribution` (jsonb: `{red: 60, white: 25, rose: 10, sparkling: 5}`)

### Nya RLS-policies

#### `wines_select_public` (ny)

```sql
CREATE POLICY wines_select_public ON wines
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = wines.user_id
        AND profiles.is_public = true
        AND profiles.show_wines = true
    )
  );
```

#### `profiles` — oförändrad

Befintlig `profiles_select_all` täcker redan lookup via `cellar_code`.

### Cellar code generation

DB-funktion som genererar unik 6-teckens kod:

```sql
CREATE OR REPLACE FUNCTION generate_cellar_code()
RETURNS text AS $$
DECLARE
  code text;
  exists boolean;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE cellar_code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;
```

Anropas via trigger eller klientkod när `is_public` sätts till `true` och `cellar_code` är null.

## Komponenter

### Nya

| Komponent | Ansvar | Max storlek |
|---|---|---|
| `cellar-lookup-modal.tsx` | Kodinput + senast besökta lista | ~150 rader |
| `public-profile-page.tsx` | Tabbad profilvy (header + flikar) | ~300 rader |
| `visibility-settings.tsx` | Tre toggles + källarkod-display + regenerera-knapp | ~100 rader |

### Återanvända (med modifieringar)

| Komponent | Ändring |
|---|---|
| `taste-profile.tsx` | Acceptera `userId` prop istället för att alltid använda `auth.uid()` |
| `wine-card.tsx` | `readonly` prop som döljer quantity, storage, notes, edit-actions |

### Ny hook

`usePublicProfile(userId | cellarCode)` — Hämtar profil, anropar `get_cellar_summary()`, hämtar viner (om synliga), hämtar smakprofil-data (om synlig). RLS hanterar access automatiskt.

## Ägarens inställningar

Ny sektion "Synlighet" på befintliga profilsidan (`profile-page.tsx`):

- Toggle: "Publik profil" (`is_public`)
- Toggle: "Visa vinlista" (`show_wines`) — disabled om `is_public` är av
- Toggle: "Visa smakprofil" (`show_taste_profile`) — disabled om `is_public` är av
- Källarkod-display (visas när `is_public` är på) + "Regenerera kod"-knapp
- Kort förklaringstext under varje toggle

## Säkerhet

- All access-kontroll sitter i RLS — klienten kan inte läcka data via buggar
- Bara autentiserade användare kan se andras källare
- `quantity`, `storage_space_id`, `notes`, `acquired_at`, `drink_by_year` exponeras aldrig via RLS-policyn (RPC returnerar bara aggregerat, vinlista filtreras i klienten via select)
- Default-deny: nya kolumner defaultar till `false`
- Cellar code är inte hemlig men ger ingen extra access

## Storage policy för vinbilder

Vinbilder ligger i Supabase Storage (privat bucket). För att publika profiler med `show_wines` ska kunna visa bilder behövs en ny storage policy:

- Bucket: `wine-images`
- Policy: Tillåt `SELECT` om bildens ägare (path prefix = `user_id/`) har `is_public = true AND show_wines = true`
- Alternativ: kopiera bilder till en public bucket vid aktivering — men onödigt komplext i v1. Storage policy räcker.

## Icke-mål (v1)

- Sökfunktion på display_name
- Vänner/följare-system
- Aktivitets-feed
- Push-notifikationer
- Djupare access via delningskod
- Visa lagringsplatser för andra
