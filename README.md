# Vinkällaren

En enkel mobilanpassad app för att hålla koll på vilka viner du har hemma.

## Starta appen

Öppna `index.html` direkt i webbläsaren eller kör en enkel lokal server i mappen:

```powershell
python -m http.server 8000
```

Besök sedan `http://localhost:8000`.

## Funktioner

- Lägg till vin med namn, producent, årgång, antal, plats och anteckningar
- Lägg till bild på flaskan som sparas lokalt i appen
- Spara streckkod manuellt eller skanna med mobilkamera när webbläsaren stöder det
- Lägg till etiketter som `middag`, `present` eller `lagring`
- Filtrera på vintyp, etikett och sök på namn, producent eller region
- Se antal flaskor totalt och vad som bör drickas snart
- Se statistik per land, vintyp och drickfönster
- Markera att du druckit en flaska eller ta bort en post
- All data sparas lokalt i webbläsaren med `localStorage`
