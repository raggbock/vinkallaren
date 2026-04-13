# Cellar Peek ("Titta in") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users share their wine cellar with others and browse other users' cellars via a cellar code, with granular privacy controls.

**Architecture:** RLS-based access control. New visibility columns on `profiles` table, new RLS policy on `wines`, new RPC for aggregated stats. Three new UI components (lookup modal, public profile page, visibility settings) plus minor modifications to existing components.

**Tech Stack:** Supabase (Postgres RLS, RPC functions, migrations), React Native, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-13-cellar-peek-design.md`

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `supabase/migrations/20260413100000_cellar_peek.sql` | DB migration: new columns, RLS policy, RPC function, cellar code generator |
| `src/components/cellar-lookup-modal.tsx` | Modal with code input + recently visited list |
| `src/components/public-profile-page.tsx` | Tabbed profile view (overview/wines/taste profile) for viewing another user |
| `src/components/visibility-settings.tsx` | Three toggles + cellar code display, embedded in profile page |
| `src/hooks/usePublicProfile.ts` | Hook to fetch another user's public profile, summary, wines, taste data |

### Modified files

| File | Change |
|---|---|
| `src/lib/profile-actions.ts` | Add `ProfileRow` fields, `updateVisibility()`, `regenerateCellarCode()`, `lookupByCellarCode()` |
| `src/components/profile-page.tsx` | Import and render `VisibilitySettings` section |
| `src/components/wine-card.tsx` | Add `readonly` prop to hide quantity, storage, notes, actions |
| `src/components/taste-profile.tsx` | No changes needed — already accepts `userId` prop |
| `App.tsx` | Add cellar-peek header icon + modal state + public profile rendering |

---

## Task 1: Database Migration

**Files:**
- Create: `mobile-app/supabase/migrations/20260413100000_cellar_peek.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- New visibility columns on profiles
ALTER TABLE profiles
  ADD COLUMN is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN show_wines boolean NOT NULL DEFAULT false,
  ADD COLUMN show_taste_profile boolean NOT NULL DEFAULT false,
  ADD COLUMN cellar_code text UNIQUE;

-- Index for cellar code lookups
CREATE INDEX idx_profiles_cellar_code ON profiles (cellar_code) WHERE cellar_code IS NOT NULL;

-- Function to generate unique 6-char cellar code
CREATE OR REPLACE FUNCTION generate_cellar_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  code_exists boolean;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE cellar_code = code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN code;
END;
$$;

-- RPC: get cellar summary for a public user
CREATE OR REPLACE FUNCTION get_cellar_summary(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  target_is_public boolean;
BEGIN
  -- Check caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check target is public
  SELECT is_public INTO target_is_public
  FROM profiles WHERE id = target_user_id;

  IF target_is_public IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'total_bottles', COALESCE(SUM(w.quantity), 0),
    'unique_labels', COUNT(DISTINCT w.name),
    'top_country', (
      SELECT w2.country FROM wines w2
      WHERE w2.user_id = target_user_id AND w2.country IS NOT NULL
      GROUP BY w2.country ORDER BY SUM(w2.quantity) DESC LIMIT 1
    ),
    'top_type', (
      SELECT w2.type FROM wines w2
      WHERE w2.user_id = target_user_id
      GROUP BY w2.type ORDER BY SUM(w2.quantity) DESC LIMIT 1
    ),
    'top_grape', (
      SELECT w2.grape FROM wines w2
      WHERE w2.user_id = target_user_id AND w2.grape IS NOT NULL
      GROUP BY w2.grape ORDER BY SUM(w2.quantity) DESC LIMIT 1
    ),
    'avg_vintage', (
      SELECT ROUND(AVG(w2.vintage)) FROM wines w2
      WHERE w2.user_id = target_user_id AND w2.vintage IS NOT NULL
    ),
    'type_distribution', (
      SELECT jsonb_object_agg(type, cnt)
      FROM (
        SELECT w2.type, SUM(w2.quantity) as cnt
        FROM wines w2
        WHERE w2.user_id = target_user_id
        GROUP BY w2.type
      ) sub
    )
  ) INTO result
  FROM wines w
  WHERE w.user_id = target_user_id;

  RETURN result;
END;
$$;

-- RLS policy: allow reading wines of public users who show wines
CREATE POLICY wines_select_public ON wines
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND user_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = wines.user_id
        AND profiles.is_public = true
        AND profiles.show_wines = true
    )
  );

-- Allow users to update their own visibility settings
CREATE POLICY profiles_update_visibility ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Storage policy: allow reading wine images of public users with show_wines
-- (assumes bucket name is 'wine-images' and paths are prefixed with user_id)
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT
  'public_wine_images_select',
  id,
  'SELECT',
  $policy$(
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id::text = (storage.foldername(name))[1]
        AND profiles.is_public = true
        AND profiles.show_wines = true
    )
  )$policy$
FROM storage.buckets WHERE name = 'wine-images'
ON CONFLICT DO NOTHING;
```

Note: The storage policy syntax depends on how Supabase storage policies are configured in this project. Read the existing storage policies (check migration files for `storage.objects` or the Supabase dashboard) and adjust accordingly. The intent: allow SELECT on wine images when the owner has `is_public = true AND show_wines = true`.

- [ ] **Step 2: Apply the migration**

Run: `cd mobile-app && npx supabase migration up --local` (or apply via Supabase MCP if using remote DB)

Verify: Check that `profiles` table has new columns, `get_cellar_summary` function exists, and `wines_select_public` policy is active.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/supabase/migrations/20260413100000_cellar_peek.sql
git commit -m "feat: add cellar peek migration (visibility columns, RLS, RPC)"
```

---

## Task 2: Update ProfileRow Type & Profile Actions

**Files:**
- Modify: `mobile-app/src/lib/profile-actions.ts`

- [ ] **Step 1: Update ProfileRow type**

In `mobile-app/src/lib/profile-actions.ts`, add the new fields to `ProfileRow` (around line 4-11):

```typescript
export type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
  is_public: boolean;
  show_wines: boolean;
  show_taste_profile: boolean;
  cellar_code: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 2: Add visibility update function**

Append to `mobile-app/src/lib/profile-actions.ts`:

```typescript
export async function updateVisibility(
  userId: string,
  patch: { is_public?: boolean; show_wines?: boolean; show_taste_profile?: boolean }
): Promise<ProfileRow | null> {
  // If turning on is_public, generate cellar code if missing
  let extras: Record<string, unknown> = {};
  if (patch.is_public === true) {
    const { data: current } = await supabase
      .from("profiles")
      .select("cellar_code")
      .eq("id", userId)
      .single();
    if (!current?.cellar_code) {
      const { data: codeResult } = await supabase.rpc("generate_cellar_code");
      extras.cellar_code = codeResult;
    }
  }
  // If turning off is_public, also turn off sub-settings
  if (patch.is_public === false) {
    patch.show_wines = false;
    patch.show_taste_profile = false;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ ...patch, ...extras })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: Add regenerate cellar code function**

Append to `mobile-app/src/lib/profile-actions.ts`:

```typescript
export async function regenerateCellarCode(userId: string): Promise<string> {
  const { data: code } = await supabase.rpc("generate_cellar_code");
  const { error } = await supabase
    .from("profiles")
    .update({ cellar_code: code })
    .eq("id", userId);
  if (error) throw error;
  return code as string;
}
```

- [ ] **Step 4: Add cellar code lookup function**

Append to `mobile-app/src/lib/profile-actions.ts`:

```typescript
export async function lookupByCellarCode(
  code: string
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("cellar_code", code.toUpperCase().trim())
    .single();
  if (error) return null;
  return data;
}
```

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/lib/profile-actions.ts
git commit -m "feat: add visibility settings and cellar code actions"
```

---

## Task 3: usePublicProfile Hook

**Files:**
- Create: `mobile-app/src/hooks/usePublicProfile.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  ProfileRow,
  lookupByCellarCode,
} from "../lib/profile-actions";
import { WineRow } from "../types/wine";
import { fetchTasteProfile, TasteProfileData } from "../lib/taste-profile";

export type CellarSummary = {
  total_bottles: number;
  unique_labels: number;
  top_country: string | null;
  top_type: string | null;
  top_grape: string | null;
  avg_vintage: number | null;
  type_distribution: Record<string, number> | null;
};

type PublicProfileState = {
  profile: ProfileRow | null;
  summary: CellarSummary | null;
  wines: WineRow[];
  tasteProfile: TasteProfileData | null;
  loading: boolean;
  error: string | null;
};

export function usePublicProfile(cellarCode: string | null) {
  const [state, setState] = useState<PublicProfileState>({
    profile: null,
    summary: null,
    wines: [],
    tasteProfile: null,
    loading: false,
    error: null,
  });

  const load = useCallback(async (code: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));

    const profile = await lookupByCellarCode(code);
    if (!profile || !profile.is_public) {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Ingen källare hittades med den koden",
        profile: null,
      }));
      return;
    }

    // Fetch summary (always available for public profiles)
    const { data: summary } = await supabase.rpc("get_cellar_summary", {
      target_user_id: profile.id,
    });

    // Fetch wines if visible (RLS handles access)
    let wines: WineRow[] = [];
    if (profile.show_wines) {
      const { data } = await supabase
        .from("wines")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });
      wines = data ?? [];
    }

    // Fetch taste profile if visible
    let tasteProfile: TasteProfileData | null = null;
    if (profile.show_taste_profile) {
      tasteProfile = await fetchTasteProfile(profile.id);
    }

    setState({
      profile,
      summary: summary as CellarSummary | null,
      wines,
      tasteProfile,
      loading: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    if (cellarCode) load(cellarCode);
  }, [cellarCode, load]);

  return state;
}
```

- [ ] **Step 2: Verify taste-profile import**

Check that `mobile-app/src/lib/taste-profile.ts` exports `fetchTasteProfile` and `TasteProfileData`. Read the file to confirm the exact export names and adjust the import in step 1 if needed.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/hooks/usePublicProfile.ts
git commit -m "feat: add usePublicProfile hook for cellar peek"
```

---

## Task 4: Visibility Settings Component

**Files:**
- Create: `mobile-app/src/components/visibility-settings.tsx`
- Modify: `mobile-app/src/components/profile-page.tsx` (line ~77, between TasteProfile and sign-out)

- [ ] **Step 1: Create VisibilitySettings component**

```typescript
import React, { useState } from "react";
import { View, Text, Switch, Pressable, StyleSheet } from "react-native";
import { ProfileRow, updateVisibility, regenerateCellarCode } from "../lib/profile-actions";
import * as Clipboard from "expo-clipboard";

type Props = {
  profile: ProfileRow;
  onUpdate: (updated: ProfileRow) => void;
  styles: { section: object; label: object; value: object };
};

export function VisibilitySettings({ profile, onUpdate, styles: s }: Props) {
  const [saving, setSaving] = useState(false);

  const toggle = async (field: "is_public" | "show_wines" | "show_taste_profile", value: boolean) => {
    setSaving(true);
    try {
      const updated = await updateVisibility(profile.id, { [field]: value });
      if (updated) onUpdate(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setSaving(true);
    try {
      const newCode = await regenerateCellarCode(profile.id);
      onUpdate({ ...profile, cellar_code: newCode });
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async () => {
    if (profile.cellar_code) {
      await Clipboard.setStringAsync(profile.cellar_code);
    }
  };

  return (
    <View style={s.section}>
      <Text style={s.label}>Synlighet</Text>

      <ToggleRow
        label="Publik profil"
        description="Andra kan se din källaröversikt"
        value={profile.is_public}
        onToggle={(v) => toggle("is_public", v)}
        disabled={saving}
      />
      <ToggleRow
        label="Visa vinlista"
        description="Andra kan se dina viner"
        value={profile.show_wines}
        onToggle={(v) => toggle("show_wines", v)}
        disabled={saving || !profile.is_public}
      />
      <ToggleRow
        label="Visa smakprofil"
        description="Andra kan se din smakprofil"
        value={profile.show_taste_profile}
        onToggle={(v) => toggle("show_taste_profile", v)}
        disabled={saving || !profile.is_public}
      />

      {profile.is_public && profile.cellar_code && (
        <View style={st.codeRow}>
          <Text style={s.label}>Din källarkod</Text>
          <Pressable onPress={copyCode} style={st.codeBadge}>
            <Text style={st.codeText}>{profile.cellar_code}</Text>
            <Text style={st.copyHint}>Tryck för att kopiera</Text>
          </Pressable>
          <Pressable onPress={handleRegenerate} disabled={saving}>
            <Text style={st.regenerate}>Generera ny kod</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onToggle,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <View style={st.toggleRow}>
      <View style={st.toggleText}>
        <Text style={st.toggleLabel}>{label}</Text>
        <Text style={st.toggleDesc}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onToggle} disabled={disabled} />
    </View>
  );
}

const st = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  toggleText: { flex: 1, marginRight: 12 },
  toggleLabel: { color: "#e8e0d4", fontSize: 15, fontWeight: "500" },
  toggleDesc: { color: "#a89880", fontSize: 12, marginTop: 2 },
  codeRow: { marginTop: 16 },
  codeBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    alignItems: "center",
  },
  codeText: {
    color: "#e8e0d4",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 4,
  },
  copyHint: { color: "#a89880", fontSize: 11, marginTop: 4 },
  regenerate: { color: "#a89880", fontSize: 13, marginTop: 12, textDecorationLine: "underline" },
});
```

- [ ] **Step 2: Wire into profile-page.tsx**

In `mobile-app/src/components/profile-page.tsx`, add the import at the top:

```typescript
import { VisibilitySettings } from "./visibility-settings";
```

Then insert the component between the TasteProfile section and the sign-out button (around line 77). Find the section after `<TasteProfile` and before the sign-out `<Pressable`, and add:

```typescript
<VisibilitySettings
  profile={profile}
  onUpdate={(updated) => setProfile(updated)}
  styles={s}
/>
```

Note: `profile-page.tsx` receives `profile` as a prop and may not have `setProfile`. Check how profile updates propagate — the `onUpdate` callback should call the parent's profile setter. If the parent passes an `onProfileUpdated` callback, use that pattern instead. Read the file to confirm the exact prop name.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/components/visibility-settings.tsx mobile-app/src/components/profile-page.tsx
git commit -m "feat: add visibility settings to profile page"
```

---

## Task 5: Wine Card Readonly Mode

**Files:**
- Modify: `mobile-app/src/components/wine-card.tsx` (lines 11-20 props, lines 49-72 header)

- [ ] **Step 1: Add readonly prop to WineCardProps**

In `mobile-app/src/components/wine-card.tsx`, update the props interface (around line 11-20) to add an optional `readonly` prop:

```typescript
export type WineCardProps = {
  wine: WineRecord;
  styles: SharedStyles;
  highlighted?: boolean;
  storageSpaceById: Map<string, StorageSpaceRow>;
  readonly?: boolean;
  onOpenSystembolaget: (wine: WineRecord) => void;
  onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void;
  onDeleteWine: (wine: WineRecord) => void;
};
```

- [ ] **Step 2: Hide private data when readonly**

In `WineCardHeader` (around lines 49-72), conditionally hide the quantity badge and storage location:

- Wrap the quantity display with `{!readonly && <QuantityBadge ... />}` (or however quantity is rendered)
- Wrap the storage location label with `{!readonly && <LocationBadge ... />}`

In the main `WineCard` component, conditionally hide:
- Notes section: `{!readonly && wine.notes && <NotesSection ... />}`
- Action buttons (edit, drink, delete): `{!readonly && <ActionButtons ... />}`

Read the exact JSX structure at those lines to determine the precise elements to wrap.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/components/wine-card.tsx
git commit -m "feat: add readonly mode to wine card"
```

---

## Task 6: Public Profile Page

**Files:**
- Create: `mobile-app/src/components/public-profile-page.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { ProfileRow, getAvatarLetter } from "../lib/profile-actions";
import { CellarSummary } from "../hooks/usePublicProfile";
import { WineRow } from "../types/wine";
import { TasteProfile } from "./taste-profile";
import { WineCard } from "./wine-card";
import { TasteProfileData } from "../lib/taste-profile";

type Tab = "overview" | "wines" | "taste";

type Props = {
  profile: ProfileRow;
  summary: CellarSummary | null;
  wines: WineRow[];
  tasteProfile: TasteProfileData | null;
  onClose: () => void;
};

export function PublicProfilePage({
  profile,
  summary,
  wines,
  tasteProfile,
  onClose,
}: Props) {
  const availableTabs: Tab[] = ["overview"];
  if (profile.show_wines && wines.length > 0) availableTabs.push("wines");
  if (profile.show_taste_profile && tasteProfile) availableTabs.push("taste");

  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const tabLabels: Record<Tab, string> = {
    overview: "Översikt",
    wines: "Viner",
    taste: "Smakprofil",
  };

  return (
    <View style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <Pressable onPress={onClose} style={st.closeBtn}>
          <Text style={st.closeTxt}>✕</Text>
        </Pressable>
        <View style={st.avatarRow}>
          <View style={[st.avatar, { backgroundColor: profile.avatar_color ?? "hsl(345,60%,40%)" }]}>
            <Text style={st.avatarLetter}>
              {getAvatarLetter(profile.display_name)}
            </Text>
          </View>
          <View>
            <Text style={st.displayName}>{profile.display_name}</Text>
            <Text style={st.subtitle}>
              {summary ? `${summary.total_bottles} flaskor` : ""}
              {profile.cellar_code ? ` · ${profile.cellar_code}` : ""}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      {availableTabs.length > 1 && (
        <View style={st.tabs}>
          {availableTabs.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[st.tab, activeTab === tab && st.tabActive]}
            >
              <Text style={[st.tabText, activeTab === tab && st.tabTextActive]}>
                {tabLabels[tab]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Content */}
      {activeTab === "overview" && summary && (
        <OverviewTab summary={summary} />
      )}
      {activeTab === "wines" && (
        <WinesTab wines={wines} />
      )}
      {activeTab === "taste" && tasteProfile && (
        <TasteProfile userId={profile.id} />
      )}
    </View>
  );
}

function OverviewTab({ summary }: { summary: CellarSummary }) {
  const stats = [
    { label: "Flaskor", value: String(summary.total_bottles) },
    { label: "Unika etiketter", value: String(summary.unique_labels) },
    { label: "Topp-land", value: summary.top_country ?? "-" },
    { label: "Vanligaste typ", value: summary.top_type ?? "-" },
    { label: "Topp-druva", value: summary.top_grape ?? "-" },
    { label: "Snitt årgång", value: summary.avg_vintage ? String(summary.avg_vintage) : "-" },
  ];

  const dist = summary.type_distribution;
  const total = dist ? Object.values(dist).reduce((a, b) => a + b, 0) : 0;

  return (
    <View style={st.content}>
      <View style={st.statsGrid}>
        {stats.map((s) => (
          <View key={s.label} style={st.statCard}>
            <Text style={st.statLabel}>{s.label}</Text>
            <Text style={st.statValue}>{s.value}</Text>
          </View>
        ))}
      </View>

      {dist && total > 0 && (
        <View style={st.distSection}>
          <Text style={st.distLabel}>Fördelning</Text>
          <View style={st.distBar}>
            {Object.entries(dist).map(([type, count]) => (
              <View
                key={type}
                style={[st.distSegment, {
                  flex: count,
                  backgroundColor: typeColor(type),
                }]}
              />
            ))}
          </View>
          <View style={st.distLegend}>
            {Object.entries(dist).map(([type, count]) => (
              <Text key={type} style={st.distLegendItem}>
                {type} {Math.round((count / total) * 100)}%
              </Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function WinesTab({ wines }: { wines: WineRow[] }) {
  const emptyMap = new Map();
  const noop = () => {};
  return (
    <FlatList
      data={wines}
      keyExtractor={(w) => w.id}
      renderItem={({ item }) => (
        <WineCard
          wine={item as any}
          styles={{} as any}
          storageSpaceById={emptyMap}
          readonly
          onOpenSystembolaget={noop}
          onEditWine={noop}
          onDrinkWine={noop}
          onDeleteWine={noop}
        />
      )}
      contentContainerStyle={st.winesList}
    />
  );
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    Rött: "#722f37",
    Vitt: "#f5e6c8",
    Rosé: "#f4a6b0",
    Bubbel: "#d4e88b",
    Orange: "#e8a84c",
    Dessert: "#c9a050",
    Starkvin: "#8b4513",
  };
  return map[type] ?? "#666";
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  header: { padding: 20, paddingTop: 48 },
  closeBtn: { position: "absolute", top: 48, right: 20, zIndex: 1 },
  closeTxt: { color: "#a89880", fontSize: 20 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
  },
  avatarLetter: { color: "#fff", fontSize: 18, fontWeight: "700" },
  displayName: { color: "#e8e0d4", fontSize: 18, fontWeight: "600" },
  subtitle: { color: "#a89880", fontSize: 13, marginTop: 2 },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 20,
  },
  tab: { paddingVertical: 12, paddingHorizontal: 16 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#722f37" },
  tabText: { color: "#a89880", fontSize: 14 },
  tabTextActive: { color: "#e8e0d4" },
  content: { padding: 20 },
  statsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
  },
  statCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8, padding: 12,
    width: "48%" as any,
  },
  statLabel: { color: "#a89880", fontSize: 11, textTransform: "uppercase" },
  statValue: { color: "#e8e0d4", fontSize: 15, marginTop: 4 },
  distSection: { marginTop: 20 },
  distLabel: { color: "#a89880", fontSize: 11, textTransform: "uppercase", marginBottom: 8 },
  distBar: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 },
  distSegment: { borderRadius: 4 },
  distLegend: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  distLegendItem: { color: "#a89880", fontSize: 10 },
  winesList: { padding: 20 },
});
```

Note: The `WinesTab` passes placeholder `styles` and noop callbacks to `WineCard`. The actual `SharedStyles` type may need to be imported and a minimal readonly style set created. Read `wine-card.tsx` to confirm what `styles` keys are actually used in readonly mode and provide only those.

- [ ] **Step 2: Commit**

```bash
git add mobile-app/src/components/public-profile-page.tsx
git commit -m "feat: add public profile page for cellar peek"
```

---

## Task 7: Cellar Lookup Modal

**Files:**
- Create: `mobile-app/src/components/cellar-lookup-modal.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ProfileRow, lookupByCellarCode, getAvatarLetter } from "../lib/profile-actions";

const RECENT_KEY = "cellar_peek_recent";
const MAX_RECENT = 10;

type RecentEntry = {
  userId: string;
  displayName: string;
  avatarColor: string | null;
  cellarCode: string;
  visitedAt: string;
};

type Props = {
  onSelectProfile: (profile: ProfileRow) => void;
  onClose: () => void;
};

export function CellarLookupModal({ onSelectProfile, onClose }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  useEffect(() => {
    loadRecent();
  }, []);

  async function loadRecent() {
    const stored = await AsyncStorage.getItem(RECENT_KEY);
    if (stored) setRecent(JSON.parse(stored));
  }

  async function handleLookup() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 3) return;

    setLoading(true);
    setError(null);
    const profile = await lookupByCellarCode(trimmed);
    setLoading(false);

    if (!profile || !profile.is_public) {
      setError("Ingen publik källare hittades med den koden");
      return;
    }

    await saveRecent(profile);
    onSelectProfile(profile);
  }

  async function saveRecent(profile: ProfileRow) {
    const entry: RecentEntry = {
      userId: profile.id,
      displayName: profile.display_name ?? "Okänd",
      avatarColor: profile.avatar_color,
      cellarCode: profile.cellar_code ?? "",
      visitedAt: new Date().toISOString(),
    };
    const updated = [entry, ...recent.filter((r) => r.userId !== profile.id)].slice(0, MAX_RECENT);
    setRecent(updated);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  }

  function handleRecentTap(entry: RecentEntry) {
    setCode(entry.cellarCode);
    // Trigger lookup with the code
    setLoading(true);
    setError(null);
    lookupByCellarCode(entry.cellarCode).then((profile) => {
      setLoading(false);
      if (profile && profile.is_public) {
        saveRecent(profile);
        onSelectProfile(profile);
      } else {
        setError("Profilen är inte längre publik");
      }
    });
  }

  return (
    <View style={st.container}>
      <View style={st.header}>
        <Text style={st.title}>Titta in i en källare</Text>
        <Pressable onPress={onClose}>
          <Text style={st.close}>✕</Text>
        </Pressable>
      </View>

      <View style={st.inputRow}>
        <TextInput
          style={st.input}
          placeholder="Skriv in en källarkod"
          placeholderTextColor="#666"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          maxLength={6}
          autoFocus
        />
        <Pressable
          style={[st.searchBtn, loading && st.searchBtnDisabled]}
          onPress={handleLookup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#e8e0d4" />
          ) : (
            <Text style={st.searchBtnText}>Sök</Text>
          )}
        </Pressable>
      </View>

      {error && <Text style={st.error}>{error}</Text>}

      {recent.length > 0 && (
        <View style={st.recentSection}>
          <Text style={st.recentLabel}>Senast besökta</Text>
          <FlatList
            data={recent}
            keyExtractor={(r) => r.userId}
            renderItem={({ item }) => (
              <Pressable style={st.recentRow} onPress={() => handleRecentTap(item)}>
                <View style={[st.recentAvatar, { backgroundColor: item.avatarColor ?? "hsl(345,60%,40%)" }]}>
                  <Text style={st.recentAvatarLetter}>
                    {getAvatarLetter(item.displayName)}
                  </Text>
                </View>
                <View style={st.recentInfo}>
                  <Text style={st.recentName}>{item.displayName}</Text>
                  <Text style={st.recentCode}>{item.cellarCode}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e", padding: 20, paddingTop: 48 },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 24,
  },
  title: { color: "#e8e0d4", fontSize: 20, fontWeight: "600" },
  close: { color: "#a89880", fontSize: 20 },
  inputRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  input: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8, padding: 14, color: "#e8e0d4",
    fontSize: 18, letterSpacing: 3, fontWeight: "600",
    textAlign: "center",
  },
  searchBtn: {
    backgroundColor: "#722f37", borderRadius: 8,
    paddingHorizontal: 20, justifyContent: "center",
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: "#e8e0d4", fontSize: 15, fontWeight: "600" },
  error: { color: "#e74c3c", fontSize: 13, marginBottom: 12 },
  recentSection: { marginTop: 24 },
  recentLabel: {
    color: "#a89880", fontSize: 11,
    textTransform: "uppercase", marginBottom: 12,
  },
  recentRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  recentAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  recentAvatarLetter: { color: "#fff", fontSize: 14, fontWeight: "700" },
  recentInfo: { flex: 1 },
  recentName: { color: "#e8e0d4", fontSize: 15 },
  recentCode: { color: "#a89880", fontSize: 12 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile-app/src/components/cellar-lookup-modal.tsx
git commit -m "feat: add cellar lookup modal with code input and recent visits"
```

---

## Task 8: Wire Into App.tsx

**Files:**
- Modify: `mobile-app/App.tsx`

- [ ] **Step 1: Add imports**

At the top of `App.tsx`, add:

```typescript
import { CellarLookupModal } from "./src/components/cellar-lookup-modal";
import { PublicProfilePage } from "./src/components/public-profile-page";
import { usePublicProfile } from "./src/hooks/usePublicProfile";
import { ProfileRow } from "./src/lib/profile-actions";
```

- [ ] **Step 2: Add state variables**

Inside the main component (after existing state declarations around line 30-40), add:

```typescript
const [cellarLookupVisible, setCellarLookupVisible] = useState(false);
const [peekProfile, setPeekProfile] = useState<ProfileRow | null>(null);
const [peekCode, setPeekCode] = useState<string | null>(null);
const publicProfile = usePublicProfile(peekCode);
```

- [ ] **Step 3: Add header icon**

Find the header/top area in the JSX. Add a search/people icon button that opens the lookup modal. Look for where the profile button is rendered (around line 251 where `onOpenProfile` is referenced) and add a cellar-peek icon near it:

```typescript
<Pressable onPress={() => setCellarLookupVisible(true)} style={{ padding: 8 }}>
  <Text style={{ color: "#a89880", fontSize: 18 }}>👥</Text>
</Pressable>
```

Read `App.tsx` carefully to find the exact right location — likely in the header area or near the profile icon. The icon should be visible from all tabs.

- [ ] **Step 4: Add modal and public profile rendering**

Before the closing `</View>` of the main container (near the end of the JSX), add:

```typescript
{cellarLookupVisible && (
  <View style={StyleSheet.absoluteFill}>
    <CellarLookupModal
      onSelectProfile={(p) => {
        setCellarLookupVisible(false);
        setPeekCode(p.cellar_code);
        setPeekProfile(p);
      }}
      onClose={() => setCellarLookupVisible(false)}
    />
  </View>
)}

{peekProfile && publicProfile.profile && (
  <View style={StyleSheet.absoluteFill}>
    <PublicProfilePage
      profile={publicProfile.profile}
      summary={publicProfile.summary}
      wines={publicProfile.wines}
      tasteProfile={publicProfile.tasteProfile}
      onClose={() => {
        setPeekProfile(null);
        setPeekCode(null);
      }}
    />
  </View>
)}
```

- [ ] **Step 5: Commit**

```bash
git add mobile-app/App.tsx
git commit -m "feat: wire cellar peek into app with header icon and modals"
```

---

## Task 9: Manual Testing & Polish

- [ ] **Step 1: Start the dev server**

```bash
cd mobile-app && npx expo start
```

- [ ] **Step 2: Test privacy defaults**

1. Open the app, go to profile page
2. Verify the three visibility toggles appear and are all OFF
3. Verify no cellar code is shown

- [ ] **Step 3: Test enabling public profile**

1. Toggle "Publik profil" ON
2. Verify a cellar code appears (6 uppercase chars)
3. Verify "Visa vinlista" and "Visa smakprofil" toggles become enabled
4. Toggle "Publik profil" OFF — verify sub-toggles turn off and disable

- [ ] **Step 4: Test cellar lookup**

1. Note the cellar code from step 3 (re-enable public profile)
2. Tap the header icon to open lookup modal
3. Enter the code and tap search
4. Verify the public profile page opens with the overview tab
5. Verify only enabled tabs appear

- [ ] **Step 5: Test with wines visible**

1. Enable "Visa vinlista" in profile settings
2. Open cellar peek from another session/account (or same account for testing)
3. Verify the Viner tab appears and shows wine names, producers, vintages
4. Verify quantity, storage location, and notes are NOT shown

- [ ] **Step 6: Test invalid/missing codes**

1. Enter a non-existent code — verify error message "Ingen publik källare hittades med den koden"
2. Enter a code for a private profile — verify same error
3. Test with empty input — verify nothing happens

- [ ] **Step 7: Test recently visited**

1. Successfully visit a profile
2. Close and reopen the lookup modal
3. Verify the profile appears in "Senast besökta"
4. Tap it — verify it opens the profile directly

- [ ] **Step 8: Test cellar code regeneration**

1. Note current code
2. Tap "Generera ny kod" in visibility settings
3. Verify a new code appears
4. Verify old code no longer works in lookup

- [ ] **Step 9: Commit any polish fixes**

```bash
git add -u
git commit -m "fix: polish cellar peek after manual testing"
```
