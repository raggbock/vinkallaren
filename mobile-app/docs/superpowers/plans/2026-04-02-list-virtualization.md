# List Virtualization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace ScrollView+.map() with FlatList/SectionList for unbounded lists, add history pagination.

**Architecture:** HistoryPanel becomes FlatList with backend pagination. MinKallarePanel becomes SectionList with infinite scroll. Virtualized panels own their RefreshControl. Memoized list item components.

**Tech Stack:** React Native (FlatList, SectionList), TypeScript, Supabase

---

## Commit 1: Extract memoized WineCard and HistoryRow components

### Task 1.1 — Extract WineCard to its own file with React.memo

Create `C:\Projects\vinkällaren\mobile-app\src\components\wine-card.tsx` by extracting the existing `WineCard` function from `min-kallare-panel.tsx` (lines 296–357) and wrapping it with `React.memo`.

- [ ] Create new file `src/components/wine-card.tsx`:

```tsx
import React from "react";
import { Image, Pressable, Text, View } from "react-native";

import { getWineStoragePlacementLabel } from "../lib/cellar-helpers";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord } from "../types/wine";

import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

export const WineCard = React.memo(function WineCard({ wine, styles, highlighted, storageSpaceById, onOpenSystembolaget, onEditWine, onDrinkWine, onDeleteWine }: {
  wine: WineRecord; styles: SharedStyles; highlighted?: boolean; storageSpaceById: Map<string, StorageSpaceRow>;
  onOpenSystembolaget: (productId: string) => void; onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void; onDeleteWine: (wineId: string, imagePath: string | null) => void;
}) {
  return (
    <View style={[styles.wineCard, highlighted && styles.wineCardHighlighted]}>
      <View style={styles.wineCardHeader}>
        {wine.image_url ? (
          <Image source={{ uri: wine.image_url }} style={{ width: 64, height: 86, borderRadius: 10, backgroundColor: "#ead8ca" }} resizeMode="cover" />
        ) : null}
        <View style={styles.flex}>
          <Text style={styles.wineType}>{wine.type}</Text>
          <Text style={styles.wineName}>{wine.name}</Text>
          <Text style={styles.wineMeta}>
            {[wine.producer, wine.vintage, wine.grape, [wine.country, wine.region].filter(Boolean).join(", ")].filter(Boolean).join(" • ")}
          </Text>
          <Text style={styles.locationText}>
            {getWineStoragePlacementLabel(wine, storageSpaceById) || wine.cellar_location || "Ingen plats angiven"}
          </Text>
          {wine.cellar_location && getWineStoragePlacementLabel(wine, storageSpaceById) ? (
            <Text style={styles.notesText}>{wine.cellar_location}</Text>
          ) : null}
        </View>
        <View style={styles.quantityBadge}><Text style={styles.quantityBadgeText}>{wine.quantity} st</Text></View>
      </View>

      {wine.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {wine.tags.map((tag) => (<View key={`${wine.id}-${tag}`} style={styles.tagPill}><Text style={styles.tagText}>{tag}</Text></View>))}
        </View>
      ) : null}

      {wine.food_pairings.length > 0 ? (
        <View style={styles.foodSection}>
          <Text style={styles.inputLabel}>Passar till</Text>
          <View style={styles.tagRow}>
            {wine.food_pairings.map((pairing) => (<View key={`${wine.id}-food-${pairing}`} style={styles.foodPill}><Text style={styles.foodText}>{pairing}</Text></View>))}
          </View>
        </View>
      ) : null}

      {wine.systembolaget_product_id ? (
        <View style={styles.foodSection}>
          <Text style={styles.inputLabel}>Importkoppling</Text>
          <Text style={styles.notesText}>Systembolaget #{wine.systembolaget_product_id}</Text>
          <Pressable onPress={() => onOpenSystembolaget(wine.systembolaget_product_id!)} style={styles.inlineLinkButton}>
            <Text style={styles.linkText}>Öppna produktsida</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.notesText}>{wine.notes || "Ingen anteckning ännu."}</Text>

      <View style={styles.actionRow}>
        <Pressable onPress={() => onEditWine(wine)}><Text style={styles.linkText}>Redigera</Text></Pressable>
        <Pressable onPress={() => onDrinkWine(wine)}><Text style={styles.linkText}>Drick</Text></Pressable>
        <Pressable onPress={() => onDeleteWine(wine.id, wine.image_path)}><Text style={styles.dangerText}>Ta bort</Text></Pressable>
      </View>
    </View>
  );
});
```

### Task 1.2 — Update min-kallare-panel.tsx to import WineCard

- [ ] In `C:\Projects\vinkällaren\mobile-app\src\components\min-kallare-panel.tsx`:

Remove the entire local `WineCard` function (lines 296–357) and add an import at the top.

**Add import** (after the existing `import { Expandable, InsightCard, ...` line 8):

```tsx
// OLD (line 8):
import { Expandable, InsightCard, LabeledInput, LoadingInline, StorageSpaceForm, SuggestionRow } from "./form-controls";

// NEW (line 8-9):
import { Expandable, InsightCard, LabeledInput, LoadingInline, StorageSpaceForm, SuggestionRow } from "./form-controls";
import { WineCard } from "./wine-card";
```

**Delete** the entire `function WineCard(...)` block at lines 296–357 (the last function in the file).

### Task 1.3 — Extract HistoryRow as memoized component

- [ ] Create new file `C:\Projects\vinkällaren\mobile-app\src\components\history-row.tsx`:

```tsx
import React from "react";
import { Image, Text, View } from "react-native";

import { buildWsatSummary, type WsatTastingData } from "../lib/wsat-data";
import type { WineHistoryRecord } from "../types/wine-history";

import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

export const HistoryRow = React.memo(function HistoryRow({ entry, styles }: {
  entry: WineHistoryRecord;
  styles: SharedStyles;
}) {
  return (
    <View style={styles.wineCard}>
      <View style={styles.wineCardHeader}>
        {entry.image_url ? (
          <Image source={{ uri: entry.image_url }} style={{ width: 64, height: 86, borderRadius: 10, backgroundColor: "#ead8ca" }} resizeMode="cover" />
        ) : null}
        <View style={styles.flex}>
          <Text style={styles.wineType}>{entry.type || "Historik"}</Text>
          <Text style={styles.wineName}>{entry.name}</Text>
          <Text style={styles.wineMeta}>
            {[entry.producer, entry.vintage, entry.grape, [entry.country, entry.region].filter(Boolean).join(", ")]
              .filter(Boolean)
              .join(" • ")}
          </Text>
        </View>
        {entry.rating ? (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>{"★".repeat(entry.rating)}{"☆".repeat(5 - entry.rating)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.notesText}>
        Dracks {new Date(entry.consumed_at).toLocaleDateString("sv-SE")} • {entry.quantity_consumed} flaska
        {entry.quantity_consumed > 1 ? "r" : ""}
      </Text>
      {entry.tasting_notes ? <Text style={styles.notesText}>{entry.tasting_notes}</Text> : null}
      {entry.tasting_data ? (
        <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#3d2220" }}>
          <Text style={[styles.notesText, { color: "#f4c38c", fontWeight: "600", marginBottom: 2 }]}>WSET Tasting</Text>
          <Text style={styles.notesText}>{buildWsatSummary(entry.tasting_data as WsatTastingData)}</Text>
        </View>
      ) : null}
    </View>
  );
});
```

### Task 1.4 — Update cellar-sections.tsx to import HistoryRow

- [ ] In `C:\Projects\vinkällaren\mobile-app\src\components\cellar-sections.tsx`:

**Add import** (after line 5 `import { buildWsatSummary...`):

```tsx
// OLD (lines 5-6):
import { buildWsatSummary, type WsatTastingData } from "../lib/wsat-data";
import type { StorageSpaceRow } from "../types/storage-space";

// NEW (lines 5-7):
import { buildWsatSummary, type WsatTastingData } from "../lib/wsat-data";
import { HistoryRow } from "./history-row";
import type { StorageSpaceRow } from "../types/storage-space";
```

**Replace** the `.map()` body (lines 197–231) with the `HistoryRow` component:

```tsx
// OLD (lines 197-231):
      {filteredEntries.map((entry) => (
        <View key={entry.id} style={styles.wineCard}>
          <View style={styles.wineCardHeader}>
            ...entire card JSX...
          </View>
        </View>
      ))}

// NEW:
      {filteredEntries.map((entry) => (
        <HistoryRow key={entry.id} entry={entry} styles={styles} />
      ))}
```

**Remove** the now-unused `Image` import from the `react-native` import line (line 2). `Image` is no longer used directly in this file after extracting `HistoryRow`.

```tsx
// OLD (line 2):
import { Image, Pressable, Text, TextInput, View } from "react-native";

// NEW (line 2):
import { Pressable, Text, TextInput, View } from "react-native";
```

**Remove** the now-unused imports from line 5 — `buildWsatSummary` and `WsatTastingData` are only used by HistoryRow which is now in its own file:

```tsx
// OLD (line 5):
import { buildWsatSummary, type WsatTastingData } from "../lib/wsat-data";

// NEW: delete this line entirely
```

- [ ] **Verify:** App compiles. Visual output is identical. Commit.

---

## Commit 2: Add history pagination to useCellarData

### Task 2.1 — Add HISTORY_PAGE_SIZE and hasMoreHistory state

- [ ] In `C:\Projects\vinkällaren\mobile-app\src\hooks\useCellarData.ts`:

**Add constant** after line 33 (`const WINES_PAGE_SIZE = 50;`):

```tsx
// OLD (line 33):
const WINES_PAGE_SIZE = 50;

// NEW (lines 33-34):
const WINES_PAGE_SIZE = 50;
const HISTORY_PAGE_SIZE = 50;
```

**Add state** after line 38 (`const [hasMoreWines, setHasMoreWines] = useState(false);`):

```tsx
// OLD (line 38):
  const [hasMoreWines, setHasMoreWines] = useState(false);

// NEW (lines 38-39):
  const [hasMoreWines, setHasMoreWines] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
```

### Task 2.2 — Rewrite fetchHistoryEntries with pagination support

- [ ] In `C:\Projects\vinkällaren\mobile-app\src\hooks\useCellarData.ts`:

Replace the `fetchHistoryEntries` function (lines 73–83):

```tsx
// OLD (lines 73-83):
  async function fetchHistoryEntries() {
    setLoadingHistory(true);
    const { data, error } = await supabase.from("wine_history").select("*").order("consumed_at", { ascending: false }).limit(100);
    if (error) {
      Alert.alert("Kunde inte hämta historiken", error.message);
      setLoadingHistory(false);
      return;
    }
    setHistoryEntries(await hydrateWineHistoryRecords((data ?? []) as WineHistoryRow[]));
    setLoadingHistory(false);
  }

// NEW:
  async function fetchHistoryEntries() {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("wine_history").select("*")
      .order("consumed_at", { ascending: false })
      .range(0, HISTORY_PAGE_SIZE - 1);
    if (error) {
      Alert.alert("Kunde inte hämta historiken", error.message);
      setLoadingHistory(false);
      return;
    }
    const rows = (data ?? []) as WineHistoryRow[];
    setHasMoreHistory(rows.length === HISTORY_PAGE_SIZE);
    setHistoryEntries(await hydrateWineHistoryRecords(rows));
    setLoadingHistory(false);
  }

  async function fetchMoreHistory() {
    if (!hasMoreHistory) return;
    const from = historyEntries.length;
    const { data, error } = await supabase
      .from("wine_history").select("*")
      .order("consumed_at", { ascending: false })
      .range(from, from + HISTORY_PAGE_SIZE - 1);
    if (error) {
      Alert.alert("Kunde inte hämta mer historik", error.message);
      return;
    }
    const rows = (data ?? []) as WineHistoryRow[];
    setHasMoreHistory(rows.length === HISTORY_PAGE_SIZE);
    const hydrated = await hydrateWineHistoryRecords(rows);
    setHistoryEntries((prev) => [...prev, ...hydrated]);
  }
```

### Task 2.3 — Expose new history pagination values from the hook

- [ ] In `C:\Projects\vinkällaren\mobile-app\src\hooks\useCellarData.ts`:

Add to the return object (after `fetchHistoryEntries,` around line 316):

```tsx
// OLD:
    fetchHistoryEntries,

// NEW:
    fetchHistoryEntries,
    fetchMoreHistory,
    hasMoreHistory,
```

- [ ] **Verify:** App compiles. History still loads (first 50 items). Commit.

---

## Commit 3: Convert HistoryPanel to FlatList + update App.tsx

### Task 3.1 — Rewrite HistoryPanel to use FlatList

- [ ] In `C:\Projects\vinkällaren\mobile-app\src\components\cellar-sections.tsx`:

Update imports at line 1-2:

```tsx
// OLD (lines 1-2):
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

// NEW (lines 1-2):
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
```

Add new props to HistoryPanel and rewrite its body. Replace the entire `HistoryPanel` function (lines 129–234 after Commit 1 changes):

```tsx
export function HistoryPanel({
  styles,
  historyEntries,
  loadingHistory,
  storageSpaceById,
  endedSessions,
  onOpenSession,
  refreshing,
  onRefresh,
  hasMoreHistory,
  onLoadMoreHistory,
}: {
  styles: SharedStyles;
  historyEntries: WineHistoryRecord[];
  loadingHistory: boolean;
  storageSpaceById: Map<string, StorageSpaceRow>;
  endedSessions?: TastingSessionRow[];
  onOpenSession?: (session: TastingSessionRow) => void;
  refreshing: boolean;
  onRefresh: () => void;
  hasMoreHistory: boolean;
  onLoadMoreHistory: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return historyEntries;
    return historyEntries.filter((entry) => {
      const haystack = [entry.name, entry.producer, entry.vintage?.toString()].filter(Boolean).join(" ").toLowerCase();
      return q.split(/\s+/).every((term) => haystack.includes(term));
    });
  }, [historyEntries, searchQuery]);

  const renderItem = useCallback(({ item }: { item: WineHistoryRecord }) => (
    <HistoryRow entry={item} styles={styles} />
  ), [styles]);

  const listHeader = (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Historik</Text>
        <Text style={styles.linkText}>{filteredEntries.length} av {historyEntries.length} poster</Text>
      </View>

      {historyEntries.length > 0 ? (
        <TextInput
          style={styles.input}
          placeholder="Sök namn, producent, årgång..."
          placeholderTextColor="#8f8178"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
      ) : null}

      {endedSessions && endedSessions.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.inputLabel}>Avslutade provningar</Text>
          {endedSessions.map((ses) => (
            <Pressable key={ses.id} style={styles.wineCard} onPress={() => onOpenSession?.(ses)}>
              <Text style={styles.wineName}>{ses.title}</Text>
              <Text style={styles.wineMeta}>
                {ses.mode === "blind" ? "Blind" : "Öppen"} · {ses.format.toUpperCase()} · {new Date(ses.created_at).toLocaleDateString("sv-SE")}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {loadingHistory ? <LoadingInline label="Laddar historik..." /> : null}

      {!loadingHistory && historyEntries.length === 0 && (!endedSessions || endedSessions.length === 0) ? (
        <Text style={styles.emptyState}>Ingen historik ännu. När du markerar att du druckit en flaska kan du sätta betyg här.</Text>
      ) : null}

      {!loadingHistory && historyEntries.length > 0 && filteredEntries.length === 0 ? (
        <Text style={styles.emptyState}>Inga träffar för "{searchQuery}"</Text>
      ) : null}
    </View>
  );

  const listFooter = hasMoreHistory ? (
    <View style={{ padding: 16, alignItems: "center" }}>
      <ActivityIndicator color="#6f1d1b" />
    </View>
  ) : null;

  return (
    <FlatList
      data={filteredEntries}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6f1d1b" colors={["#6f1d1b"]} />}
      onEndReached={hasMoreHistory ? onLoadMoreHistory : undefined}
      onEndReachedThreshold={0.5}
      initialNumToRender={20}
      maxToRenderPerBatch={10}
      windowSize={5}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    />
  );
}
```

### Task 3.2 — Update App.tsx: remove parent ScrollView, pass refresh props to panels

- [ ] In `C:\Projects\vinkällaren\mobile-app\App.tsx`:

**Update imports** (line 4): add `View as RNView` is already there, but remove `ScrollView` and `RefreshControl` from the import since they move into panels. Actually — keep them for the non-virtualized panels (meal, add) that still need a parent ScrollView.

No import changes needed — `ScrollView` and `RefreshControl` are still used.

**Update the HistoryPanel rendering** (around line 253–257). Add the new props:

```tsx
// OLD (lines 253-257):
  } else if (activeSection === "history") {
    activePanel = <HistoryPanel styles={styles} historyEntries={data.historyEntries} loadingHistory={data.loadingHistory} storageSpaceById={data.storageSpaceById}
      endedSessions={tastingSessions.sessions.filter((ses) => ses.status === "ended")}
      onOpenSession={(ses) => { setTastingSessionsVisible(true); setActiveSection("cellar"); tastingSessions.openSession(ses); }}
    />;

// NEW:
  } else if (activeSection === "history") {
    activePanel = <HistoryPanel styles={styles} historyEntries={data.historyEntries} loadingHistory={data.loadingHistory} storageSpaceById={data.storageSpaceById}
      endedSessions={tastingSessions.sessions.filter((ses) => ses.status === "ended")}
      onOpenSession={(ses) => { setTastingSessionsVisible(true); setActiveSection("cellar"); tastingSessions.openSession(ses); }}
      refreshing={refreshing} onRefresh={onRefresh}
      hasMoreHistory={data.hasMoreHistory} onLoadMoreHistory={data.fetchMoreHistory}
    />;
```

**Replace the parent ScrollView wrapper** (lines 358–364) with a conditional structure. Virtualized panels render directly; non-virtualized panels keep ScrollView:

```tsx
// OLD (lines 358-364):
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scrollFlex} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6f1d1b" colors={["#6f1d1b"]} />}>
        {activePanel}
        <RNView style={styles.footerRow}>
          <RNText style={styles.footerVersion}>{BUILD_VERSION}</RNText>
          <Pressable onPress={privacy.open}><RNText style={styles.footerLink}>Integritetspolicy</RNText></Pressable>
        </RNView>
      </ScrollView>

// NEW:
      {(activeSection === "history" || (activeSection === "cellar" && !tastingSessionsVisible)) ? (
        <RNView style={styles.scrollFlex}>
          {activePanel}
        </RNView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scrollFlex} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6f1d1b" colors={["#6f1d1b"]} />}>
          {activePanel}
          <RNView style={styles.footerRow}>
            <RNText style={styles.footerVersion}>{BUILD_VERSION}</RNText>
            <Pressable onPress={privacy.open}><RNText style={styles.footerLink}>Integritetspolicy</RNText></Pressable>
          </RNView>
        </ScrollView>
      )}
```

- [ ] **Verify:** History tab renders as FlatList with pull-to-refresh. Infinite scroll loads more entries. Other tabs still work in ScrollView. Commit.

---

## Commit 4: Convert MinKallarePanel to SectionList + update App.tsx

### Task 4.1 — Add refreshing/onRefresh props to MinKallarePanel

- [ ] In `C:\Projects\vinkällaren\mobile-app\src\components\min-kallare-panel.tsx`:

**Add props** to the function signature (after `onClearHighlight` around line 71):

```tsx
// OLD (line 71):
  onClearHighlight?: () => void;

// NEW:
  onClearHighlight?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
```

**Add to the props type** (after the type annotation for `onClearHighlight`):

```tsx
// OLD:
  onClearHighlight?: () => void;
}) {

// NEW:
  onClearHighlight?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
```

### Task 4.2 — Rewrite MinKallarePanel body to use SectionList

- [ ] In `C:\Projects\vinkällaren\mobile-app\src\components\min-kallare-panel.tsx`:

**Update imports** (lines 1-2):

```tsx
// OLD (lines 1-2):
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";

// NEW (lines 1-2):
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, SectionList, Text, View } from "react-native";
```

Note: `Image` is removed — it's now in `wine-card.tsx`.

**Build sections data** inside the component body. Replace the current `winesBySpace` / `spaceCards` / render logic. After the `summaryText` const (around line 121), add a `sections` computation and rewrite the return to use SectionList.

Replace everything from the `return (` statement (line 122) through the closing of the function (line 242) with:

```tsx
  type SectionData = {
    title: string;
    spaceType: string;
    spaceId: string;
    bottleCount: number;
    space: StorageSpaceRow | null;
    data: WineRecord[];
  };

  const sections = useMemo((): SectionData[] => {
    const result: SectionData[] = [];
    if (unplacedWines.length > 0) {
      result.push({
        title: "Otilldelade",
        spaceType: "Behöver plats",
        spaceId: "__unplaced__",
        bottleCount: unplacedWines.length,
        space: null,
        data: expandedSpaceIds.has("__unplaced__") ? unplacedWines : [],
      });
    }
    for (const card of spaceCards) {
      result.push({
        title: card.name,
        spaceType: SPACE_TYPE_LABELS[card.spaceType] || card.spaceType,
        spaceId: card.id,
        bottleCount: card.bottleCount,
        space: storageSpaceById.get(card.id) || null,
        data: expandedSpaceIds.has(card.id) ? card.wines : [],
      });
    }
    return result;
  }, [unplacedWines, spaceCards, expandedSpaceIds, storageSpaceById]);

  const renderSectionHeader = useCallback(({ section }: { section: SectionData }) => {
    const isExpanded = expandedSpaceIds.has(section.spaceId);
    const isUnplaced = section.spaceId === "__unplaced__";
    return (
      <View>
        <Pressable onPress={() => toggleSpace(section.spaceId)} style={[styles.storageCard, isUnplaced && { borderWidth: 2, borderColor: "#f4c38c" }]}>
          <View style={styles.storageCardHeader}>
            <View style={styles.flex}>
              <Text style={styles.wineType}>{section.spaceType}</Text>
              <Text style={styles.wineName}>{section.title}</Text>
            </View>
            <View style={styles.storageCardRight}>
              <View style={[styles.quantityBadge, isUnplaced && { backgroundColor: "#f4c38c" }]}>
                <Text style={styles.quantityBadgeText}>{section.bottleCount} st</Text>
              </View>
              <Text style={styles.statsSummaryToggle}>{isExpanded ? "▲" : "▼"}</Text>
            </View>
          </View>
        </Pressable>
        {isExpanded && section.space ? (
          <StorageSpaceActions space={section.space} styles={styles} onUpdate={onUpdateStorageSpace} onDelete={onDeleteStorageSpace} />
        ) : null}
      </View>
    );
  }, [expandedSpaceIds, styles, onUpdateStorageSpace, onDeleteStorageSpace]);

  const renderItem = useCallback(({ item }: { item: WineRecord }) => (
    <WineCard wine={item} styles={styles} highlighted={item.id === highlightedWineId} storageSpaceById={storageSpaceById} onOpenSystembolaget={onOpenSystembolaget} onEditWine={onEditWine} onDrinkWine={onDrinkWine} onDeleteWine={onDeleteWine} />
  ), [styles, highlightedWineId, storageSpaceById, onOpenSystembolaget, onEditWine, onDrinkWine, onDeleteWine]);

  const listHeader = (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Min källare</Text>
        <Pressable onPress={onSignOut}><Text style={styles.linkText}>Logga ut</Text></Pressable>
      </View>

      <Pressable onPress={() => setStatsExpanded((v) => !v)} style={styles.statsSummaryBar}>
        <Text style={styles.statsSummaryText}>{summaryText}</Text>
        <Text style={styles.statsSummaryToggle}>{statsExpanded ? "▲" : "▼"}</Text>
      </Pressable>

      <Expandable expanded={statsExpanded}>
        <View style={styles.statsGrid}>
          <View style={styles.statsGridRow}>
            <InsightCard label="Mest flaskor från" value={stats.topCountry} />
            <InsightCard label="Vanligaste typ" value={stats.topType} />
          </View>
          <View style={styles.statsGridRow}>
            <InsightCard label="Vanligaste matmatch" value={stats.topPairing} />
            <InsightCard label="Snittårgång" value={stats.averageVintage} />
          </View>
          <Pressable onPress={onRefreshStats}><Text style={styles.linkText}>Uppdatera statistik</Text></Pressable>
        </View>
      </Expandable>

      <LabeledInput label="Sök" value={searchQuery} onChangeText={onSearchChange} placeholder="namn, druva, region, mat..." />
      <SuggestionRow title="Filtrera mat" options={pairingOptions} selected={selectedPairingFilter} onSelect={onPairingChange} />
      <SuggestionRow title="Filtrera land" options={countryOptions} selected={selectedCountryFilter} onSelect={onCountryChange} />
      <SuggestionRow title="Filtrera region" options={regionOptions} selected={selectedRegionFilter} onSelect={onRegionChange} />
      <SuggestionRow title="Filtrera typ" options={typeOptions} selected={selectedTypeFilter} onSelect={onTypeChange} />
      <SuggestionRow title="Filtrera årgång" options={vintageOptions} selected={selectedVintageFilter} onSelect={onVintageChange} />
      {storageSpaces.length > 0 ? (
        <SuggestionRow
          title="Filtrera plats"
          options={["Alla", ...storageSpaces.map((s) => s.name)]}
          selected={selectedStorageSpaceFilterId ? storageSpaceById.get(selectedStorageSpaceFilterId)?.name || "Alla" : "Alla"}
          onSelect={(name) => {
            const space = storageSpaces.find((s) => s.name === name);
            onStorageSpaceFilterChange(space?.id || "");
          }}
        />
      ) : null}

      {loading ? <LoadingInline /> : null}

      <Pressable onPress={onOpenTastingSessions} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Provningar</Text>
      </Pressable>

      <StorageSpaceForm draft={storageSpaceDraft} saving={savingStorageSpace} onDraftChange={onStorageSpaceDraftChange} onSave={onSaveStorageSpace} />

      {!loading && spaceCards.length === 0 && unplacedWines.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>Din källare är tom</Text>
          <Text style={styles.emptyState}>Kom igång genom att lägga till ditt första vin — skanna en streckkod eller fyll i för hand.</Text>
          <Pressable onPress={onNavigateToAdd} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Lägg till vin</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const listFooter = hasMoreWines ? (
    <View style={{ padding: 16, alignItems: "center" }}>
      <ActivityIndicator color="#6f1d1b" />
    </View>
  ) : null;

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6f1d1b" colors={["#6f1d1b"]} />}
      onEndReached={hasMoreWines ? onLoadMoreWines : undefined}
      onEndReachedThreshold={0.5}
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={5}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
    />
  );
```

### Task 4.3 — Pass refreshing/onRefresh props from App.tsx to MinKallarePanel

- [ ] In `C:\Projects\vinkällaren\mobile-app\App.tsx`:

Add the two new props to the MinKallarePanel usage (around line 233, after `onClearHighlight`):

```tsx
// OLD (line 233):
      onClearHighlight={() => setHighlightedWineId(null)}
    />

// NEW:
      onClearHighlight={() => setHighlightedWineId(null)}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
```

- [ ] **Verify:** Cellar tab renders as SectionList with pull-to-refresh. Infinite scroll replaces "Ladda fler" button. Sections expand/collapse. Highlighted wine auto-expands its section. Commit.

---

## Post-implementation checklist

- [ ] All four files compile without TypeScript errors
- [ ] Pull-to-refresh works on cellar tab (SectionList)
- [ ] Pull-to-refresh works on history tab (FlatList)
- [ ] Scrolling to bottom of history loads more (pagination)
- [ ] Scrolling to bottom of cellar loads more wines (infinite scroll)
- [ ] Empty states still display correctly
- [ ] Meal planner and Add wine tabs still work in ScrollView
- [ ] Tab switching mid-scroll works without crashes
- [ ] No file exceeds 500 lines
- [ ] No function exceeds 50 lines
