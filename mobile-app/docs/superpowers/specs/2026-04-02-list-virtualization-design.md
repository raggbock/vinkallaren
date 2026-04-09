# List Virtualization — Design Spec

**Date:** 2026-04-02
**Status:** Draft

## Problem

All lists render with ScrollView + `.map()`. No FlatList usage anywhere. This degrades as cellars grow (100+ wines, 500+ history entries).

## What Gets Virtualized

| Component | Action | Reason |
|-----------|--------|--------|
| HistoryPanel | FlatList + backend pagination | Unbounded growth, 100-item hard cap |
| MinKallarePanel | SectionList (grouped by space) | Unbounded, already has backend pages |
| MealPlannerPanel | No change | Filtered subset, rarely >20 items |
| TastingSessionModal | No change | Max ~12 wines per session |
| Other lists | No change | Small fixed lists |

## Nested Scroll Strategy

The app renders panels inside a parent ScrollView in App.tsx. Nesting FlatList inside ScrollView breaks virtualization in React Native.

**Decision:** Each virtualized panel becomes the scroll root. The parent stops being a ScrollView for those panels — it renders the active panel directly. Non-virtualized panels keep their own ScrollView.

### App.tsx structure change

```tsx
// Before:
<ScrollView refreshControl={<RefreshControl />}>
  {activeSection === 'kallare' && <MinKallarePanel />}
  {activeSection === 'historik' && <HistoryPanel />}
</ScrollView>

// After:
<View style={{ flex: 1 }}>
  {activeSection === 'kallare' && <MinKallarePanel refreshing={refreshing} onRefresh={onRefresh} />}
  {activeSection === 'historik' && <HistoryPanel refreshing={refreshing} onRefresh={onRefresh} />}
  {activeSection === 'matplanering' && (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <MealPlannerPanel ... />
    </ScrollView>
  )}
</View>
```

## MinKallarePanel — SectionList

Current: groups wines by storage space with `.map()`, renders each group with header + wine cards.

New: `SectionList` with sections derived from grouped wines.

```tsx
<SectionList
  sections={sections}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <WineCard wine={item} />}
  renderSectionHeader={({ section }) => <SpaceHeader title={section.title} />}
  ListHeaderComponent={<KallareHeader />}  // search bar, filters, stats
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
  onEndReached={hasMore ? fetchMoreWines : undefined}
  onEndReachedThreshold={0.5}
  initialNumToRender={15}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

Replace manual "Ladda fler" button with `onEndReached` infinite scroll.

## HistoryPanel — FlatList + Backend Pagination

### Backend: add pagination to history

Add to `useCellarData.ts` (or extract to `useHistoryData.ts` if near 500-line cap):

```ts
const HISTORY_PAGE_SIZE = 50;

async function fetchHistoryEntries(reset = false) {
  const from = reset ? 0 : historyEntries.length;
  const { data } = await supabase
    .from('wine_history').select('*')
    .order('consumed_at', { ascending: false })
    .range(from, from + HISTORY_PAGE_SIZE - 1);
  if (data) {
    setHistoryEntries(reset ? hydrated : [...historyEntries, ...hydrated]);
    setHasMoreHistory(data.length === HISTORY_PAGE_SIZE);
  }
}
```

### Component

```tsx
<FlatList
  data={entries}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
  ListHeaderComponent={<HistoryHeader />}
  ListEmptyComponent={<Text>Ingen historik att visa</Text>}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
  onEndReached={hasMore ? onLoadMore : undefined}
  onEndReachedThreshold={0.5}
  ListFooterComponent={loadingMore ? <ActivityIndicator /> : null}
  initialNumToRender={20}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

## Extract Memoized List Items

Both `renderItem` functions need stable components for virtualization to work:

```tsx
const WineCard = React.memo(function WineCard({ wine }: { wine: WineRecord }) {
  // existing wine card JSX extracted from current .map() body
});

const HistoryRow = React.memo(function HistoryRow({ entry }: { entry: WineHistoryRecord }) {
  // existing history row JSX extracted from current .map() body
});
```

## New Hooks/Helpers

| Item | Location | Purpose |
|------|----------|---------|
| History pagination state | `useCellarData.ts` or new `useHistoryData.ts` | `hasMoreHistory`, `fetchMoreHistory` |
| `HISTORY_PAGE_SIZE` | Same | Constant, value 50 |

No other new hooks needed. Wine pagination already exists in `useCellarData.ts`.

## Implementation Order

1. Extract memoized WineCard and HistoryRow components (pure refactor)
2. Add history pagination to data hook (keep old `.map()` rendering working)
3. Convert HistoryPanel to FlatList, update App.tsx scroll structure
4. Convert MinKallarePanel to SectionList, replace "Ladda fler" with infinite scroll
5. Test: empty lists, pull-to-refresh, rapid scrolling, tab switching while loading

## Performance Tuning

Conservative starting values, adjust based on testing:

- `initialNumToRender`: 15-20
- `maxToRenderPerBatch`: 10
- `windowSize`: 5
- `removeClippedSubviews`: avoid on iOS (known bugs), test on Android
- `getItemLayout`: add if rows are fixed height (history likely is, wine cards may vary)
