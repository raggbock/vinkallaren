# Offline-stöd för vinprovningar — Design

**Datum:** 2026-04-21
**Scope:** Offline-first för `tasting_sessions` (grupprovningar) och WSET-solo-provningar via `tasting-session-modal`. Ej källaren i övrigt, ej snabbetyg på vin i källaren.

## Mål

Användare ska kunna:
- Delta i pågående provning offline (betyg, anteckningar, WSET-fält).
- Skapa/starta provning och lägga till viner (från egen källare) offline.
- Bläddra tidigare provningar och resultat offline.
- Spara WSET-draft lokalt och synka när nät finns.

Allt synkas automatiskt vid nätverksåterkomst med "last write wins".

## Arkitektur

Tre nya moduler i `mobile-app/src/`:

### `lib/offline-store.ts`
Tunn key-value-wrapper över `AsyncStorage` (RN) och `localStorage` (web). JSON-serialisering. Namespaced nycklar.

```
tasting:sessions              TastingSessionRow[]
tasting:session:<id>:wines    SessionWineRow[]
tasting:session:<id>:tastings SessionTastingRow[]
tasting:queue                 QueueItem[]
wset:draft:<wineId>           Partial<WSETForm>
wset:queue                    QueueItem[]
offline:lastSync:<sessionId>  ISO timestamp
```

### `lib/sync-queue.ts`
Append-only FIFO-kö av väntande skrivningar. Exponentiell backoff: 1s, 4s, 15s, 60s, cap 5 min. Max 10 försök innan item markeras `failed` och UI visar banner.

```ts
type QueueItem = {
  id: string;
  kind:
    | "upsert_session_tasting"
    | "create_session"
    | "add_session_wine"
    | "submit_wset";
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
};
```

### `hooks/useOnlineStatus.ts`
Lyssnar `NetInfo` (RN) och `navigator.onLine` + `visibilitychange` (web). Returnerar `{ online, lastSync }`. Triggar `sync-queue.drain()` vid online + foreground.

## Berörd befintlig kod

- `hooks/useTastingSessions.ts` — läs cache först, sedan server (SWR). Skrivningar går via kön.
- `lib/session-actions.ts` — nya varianter `queueRating`, `queueNote`, `queueCreateSession`, `queueAddWine` som skriver lokalt + köar.
- `components/tasting-session-modal.tsx` — auto-sparar WSET-draft i `offline-store`. Submit köar.
- Realtime-subscriptions pausas vid offline, återupprättas vid online.

## Dataflöde (exempel: betygsätta offline)

1. UI anropar `queueRating(sessionWineId, rating)`.
2. Optimistisk: `setActiveTastings` lägger in raden direkt.
3. Persistens: skriv till `tasting:session:<id>:tastings`.
4. Kö: push till `tasting:queue`.
5. Drain vid online: FIFO mot Supabase, ta bort vid success, backoff vid fel.
6. Reconciliation vid `openSession` online: hämta serverstate, lägg osynkade kö-items ovanpå.

## UI-indikatorer

- "Offline"-badge i provningsheadern när `!online`.
- Rader med osynkad data: diskret klockikon.
- Item som failar 10 ggr: toast "Kunde inte synka — försök igen" + retry-knapp.
- "Skapa provning" offline: join-kod visas som "Synkas när du är online — koden kommer snart".
- "Lägg till vin" offline: bara `CellarPicker` från lokal källa-cache. Katalog-sök gråas ut med tooltip "Kräver nätverk".

## Begränsningar och beslut

- Ingen konfliktlösning — Supabase `upsert` + "last write wins" räcker.
- Gäst som skapar session offline: server genererar kod först vid synk.
- Städning: när `status = "completed"` och lastSync färsk, droppa `wines`/`tastings`-nycklarna men behåll sessionen i listan.
- Storlek: en provning med 8 viner och 5 deltagare ≈ 20 KB JSON. Väl inom 5 MB-gränsen.

## Testning

- Unit: `sync-queue` (FIFO, backoff, reconciliation merge), `offline-store` (serialisering, namespacing).
- Integration: mocka `supabase` + toggla online-status, verifiera att rating överlever reload + nätfall.
- Utöka `lib/__tests__/session-actions.test.ts` med kö-varianter.

## Risker

- RLS-fel vid synk (t.ex. sessionen avslutad av värd) — item markeras failed, användaren ser sin lokala data + varningsbanner.
- Två offline-enheter skriver olika betyg för samma `(user_id, session_wine_id)` — upsert löser, last write wins.
- Katalog-backfill sker idag per-vin vid load. Offline måste detta skippas tyst.

## Filpåverkan (uppskattning)

- Nya filer: `offline-store.ts`, `sync-queue.ts`, `useOnlineStatus.ts` — ~100–150 rader vardera.
- Ändringar: `useTastingSessions.ts`, `session-actions.ts`, `tasting-session-modal.tsx` — små deltas, köpad är tunn.
- Inga filer ska passera 500-radersgränsen.
