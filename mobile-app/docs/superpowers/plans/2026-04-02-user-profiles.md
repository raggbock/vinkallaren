# User Profiles & Display Names — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every user a display name and deterministic avatar so tasting sessions show real identities instead of email fragments.

**Architecture:** Migration adds `avatar_color` to profiles and opens RLS for cross-user reads. A `useProfile` hook fetches/updates the current user's profile. A blocking modal prompts for a display name on first login. An `Avatar` component renders the first-letter circle everywhere participants appear.

**Tech Stack:** React Native / Expo, Supabase Postgres + RLS, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-02-tasting-experience-design.md` — Subsystem 1

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/20260402160000_profiles_avatar_color.sql` | Add avatar_color column, update RLS |
| Create | `src/lib/profile-actions.ts` | Fetch profile, update profile, avatar color generation |
| Create | `src/hooks/useProfile.ts` | Profile state for current user |
| Create | `src/components/avatar.tsx` | Avatar circle component |
| Create | `src/components/display-name-prompt.tsx` | Blocking modal for first-time display name |
| Create | `src/components/profile-page.tsx` | Profile settings page |
| Modify | `App.tsx` | Add profile hook, display name prompt, profile page routing |
| Modify | `src/components/form-controls.tsx` | PanelHeader: add optional left icon |
| Modify | `src/components/min-kallare-panel.tsx` | Replace "Logga ut" with settings icon |
| Modify | `src/components/tasting-session-modal.tsx` | Use Avatar in participant display |

---

### Task 1: Database Migration — avatar_color + RLS

**Files:**
- Create: `supabase/migrations/20260402160000_profiles_avatar_color.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Add avatar_color column
alter table public.profiles
  add column if not exists avatar_color text;

-- Allow all authenticated users to read any profile (needed for session participant display)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_all"
on public.profiles
for select to authenticated
using (true);

-- Keep insert/update restricted to own profile (unchanged, just re-stated for clarity)
-- These already exist from init migration, no changes needed.
```

- [ ] **Step 2: Apply the migration**

Run via Supabase MCP tool `apply_migration`:
- Name: `profiles_avatar_color`
- SQL: the content from step 1

Verify: query `select column_name from information_schema.columns where table_name = 'profiles'` should include `avatar_color`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260402160000_profiles_avatar_color.sql
git commit -m "feat: add avatar_color to profiles, open RLS for cross-user reads"
```

---

### Task 2: Profile Actions — fetch, update, avatar color

**Files:**
- Create: `src/lib/profile-actions.ts`

- [ ] **Step 1: Write profile-actions.ts**

```typescript
import { ok, fail, type Result } from "../types/result";
import { supabase } from "./supabase";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Deterministic avatar color from user ID.
 * Hashes the UUID to a hue in the wine-red palette (HSL).
 */
export function generateAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  // Map to warm hue range: 0-30 (reds/oranges) and 330-360 (magentas/reds)
  const hue = ((Math.abs(hash) % 60) + 330) % 360;
  return `hsl(${hue}, 45%, 35%)`;
}

export function getAvatarLetter(displayName: string | null): string {
  if (!displayName || displayName.trim().length === 0) return "?";
  return displayName.trim()[0].toUpperCase();
}

export async function fetchProfile(userId: string): Promise<Result<ProfileRow>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return fail(error.message);
  return ok(data as ProfileRow);
}

export async function updateProfile(
  userId: string,
  patch: { display_name?: string; avatar_color?: string },
): Promise<Result<ProfileRow>> {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("*")
    .single();
  if (error) return fail(error.message);
  return ok(data as ProfileRow);
}

/**
 * Sets display name and avatar color in one call.
 * Used by the display name prompt on first login.
 */
export async function setDisplayName(
  userId: string,
  displayName: string,
): Promise<Result<ProfileRow>> {
  const color = generateAvatarColor(userId);
  return updateProfile(userId, { display_name: displayName, avatar_color: color });
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit src/lib/profile-actions.ts 2>&1 | head -20`

Expected: no errors (or only unrelated pre-existing ones).

- [ ] **Step 3: Commit**

```bash
git add src/lib/profile-actions.ts
git commit -m "feat: add profile fetch/update actions with avatar color generation"
```

---

### Task 3: useProfile Hook

**Files:**
- Create: `src/hooks/useProfile.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useCallback, useEffect, useState } from "react";
import {
  fetchProfile,
  setDisplayName,
  updateProfile,
  generateAvatarColor,
  type ProfileRow,
} from "../lib/profile-actions";
import { showError } from "../lib/show-error";

export function useProfile(userId: string) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchProfile(userId).then((result) => {
      if (!mounted) return;
      if (result.data) {
        // Ensure avatar_color is set (backfill for existing users)
        if (!result.data.avatar_color) {
          const color = generateAvatarColor(userId);
          updateProfile(userId, { avatar_color: color }).then((r) => {
            if (r.data && mounted) setProfile(r.data);
          });
          setProfile({ ...result.data, avatar_color: color });
        } else {
          setProfile(result.data);
        }
      }
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [userId]);

  /** True when display name is missing or still the email placeholder */
  const needsDisplayName =
    !loading &&
    profile != null &&
    (!profile.display_name ||
      profile.display_name.includes("@"));

  const saveDisplayName = useCallback(
    async (name: string) => {
      const result = await setDisplayName(userId, name);
      if (result.error) {
        showError("Kunde inte spara namn", result.error);
        return false;
      }
      setProfile(result.data!);
      return true;
    },
    [userId],
  );

  const updateName = useCallback(
    async (name: string) => {
      const result = await updateProfile(userId, { display_name: name });
      if (result.error) {
        showError("Kunde inte uppdatera namn", result.error);
        return false;
      }
      setProfile(result.data!);
      return true;
    },
    [userId],
  );

  return { profile, loading, needsDisplayName, saveDisplayName, updateName };
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit src/hooks/useProfile.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProfile.ts
git commit -m "feat: add useProfile hook with display name check and backfill"
```

---

### Task 4: Avatar Component

**Files:**
- Create: `src/components/avatar.tsx`

- [ ] **Step 1: Write the Avatar component**

```typescript
import { StyleSheet, Text, View } from "react-native";
import { generateAvatarColor, getAvatarLetter } from "../lib/profile-actions";

type AvatarProps = {
  displayName: string | null;
  userId: string;
  avatarColor?: string | null;
  size?: number;
};

export function Avatar({ displayName, userId, avatarColor, size = 32 }: AvatarProps) {
  const bg = avatarColor || generateAvatarColor(userId);
  const letter = getAvatarLetter(displayName);
  const fontSize = size * 0.45;
  return (
    <View style={[s.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[s.letter, { fontSize }]}>{letter}</Text>
    </View>
  );
}

type AvatarRowProps = {
  participants: Array<{ user_id: string; display_name: string | null; avatar_color?: string | null }>;
  size?: number;
  max?: number;
};

export function AvatarRow({ participants, size = 28, max = 8 }: AvatarRowProps) {
  const shown = participants.slice(0, max);
  const overflow = participants.length - max;
  return (
    <View style={s.row}>
      {shown.map((p, i) => (
        <View key={p.user_id} style={[s.rowItem, i > 0 && { marginLeft: -size * 0.15 }]}>
          <Avatar displayName={p.display_name} userId={p.user_id} avatarColor={p.avatar_color} size={size} />
        </View>
      ))}
      {overflow > 0 ? (
        <View style={[s.circle, s.overflow, { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.15 }]}>
          <Text style={[s.letter, { fontSize: size * 0.35 }]}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fffaf5",
  },
  letter: {
    color: "#fffaf5",
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowItem: {
    zIndex: 1,
  },
  overflow: {
    backgroundColor: "#564a40",
    zIndex: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fffaf5",
  },
});
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit src/components/avatar.tsx 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/avatar.tsx
git commit -m "feat: add Avatar and AvatarRow components with deterministic colors"
```

---

### Task 5: Display Name Prompt Modal

**Files:**
- Create: `src/components/display-name-prompt.tsx`

- [ ] **Step 1: Write the prompt modal**

```typescript
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type DisplayNamePromptProps = {
  visible: boolean;
  saving: boolean;
  onSave: (name: string) => void;
  onSkip: () => void;
};

export function DisplayNamePrompt({ visible, saving, onSave, onSkip }: DisplayNamePromptProps) {
  const [name, setName] = useState("");

  if (!visible) return null;

  const canSave = name.trim().length >= 2;

  return (
    <View style={s.overlay}>
      <View style={s.card}>
        <Text style={s.title}>Välj ett användarnamn</Text>
        <Text style={s.subtitle}>
          Ditt namn visas för andra deltagare i provningar.
        </Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="Minst 2 tecken"
          placeholderTextColor="#8f8178"
          autoFocus
          maxLength={30}
          returnKeyType="done"
          onSubmitEditing={() => canSave && onSave(name.trim())}
        />
        <Pressable
          onPress={() => onSave(name.trim())}
          style={[s.primaryBtn, !canSave && s.disabled]}
          disabled={!canSave || saving}
        >
          <Text style={s.primaryBtnText}>{saving ? "Sparar..." : "Spara"}</Text>
        </Pressable>
        <Pressable onPress={onSkip} disabled={saving}>
          <Text style={s.skipText}>Hoppa över</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(26, 15, 14, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: 24,
  },
  card: {
    backgroundColor: "#2b1714",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 380,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(244, 195, 140, 0.15)",
  },
  title: {
    color: "#f4c38c",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: "#c4a882",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#1a0f0e",
    borderWidth: 1,
    borderColor: "rgba(90, 58, 56, 0.6)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fffaf5",
    fontSize: 16,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: "#f4c38c",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#2b1714",
    fontWeight: "700",
    fontSize: 15,
  },
  disabled: {
    opacity: 0.4,
  },
  skipText: {
    color: "#8f8178",
    fontSize: 13,
    textAlign: "center",
  },
});
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit src/components/display-name-prompt.tsx 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/display-name-prompt.tsx
git commit -m "feat: add display name prompt modal for first-time users"
```

---

### Task 6: Profile Page

**Files:**
- Create: `src/components/profile-page.tsx`

- [ ] **Step 1: Write the profile page**

```typescript
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar } from "./avatar";
import { PanelHeader } from "./form-controls";
import type { ProfileRow } from "../lib/profile-actions";

type ProfilePageProps = {
  profile: ProfileRow;
  onUpdateName: (name: string) => Promise<boolean>;
  onSignOut: () => void;
  onBack: () => void;
};

export function ProfilePage({ profile, onUpdateName, onSignOut, onBack }: ProfilePageProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.display_name || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (name.trim().length < 2) return;
    setSaving(true);
    const ok = await onUpdateName(name.trim());
    setSaving(false);
    if (ok) setEditing(false);
  }

  return (
    <View>
      <PanelHeader title="Profil" rightLabel="Tillbaka" onRightPress={onBack} />

      <View style={s.section}>
        <View style={s.avatarRow}>
          <Avatar
            displayName={profile.display_name}
            userId={profile.id}
            avatarColor={profile.avatar_color}
            size={64}
          />
          {editing ? (
            <View style={s.editRow}>
              <TextInput
                style={s.nameInput}
                value={name}
                onChangeText={setName}
                autoFocus
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              <Pressable onPress={handleSave} style={s.saveBtn} disabled={saving || name.trim().length < 2}>
                <Text style={s.saveBtnText}>{saving ? "..." : "Spara"}</Text>
              </Pressable>
              <Pressable onPress={() => { setEditing(false); setName(profile.display_name || ""); }}>
                <Text style={s.cancelText}>Avbryt</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditing(true)} style={s.nameRow}>
              <Text style={s.displayName}>{profile.display_name || "Inget namn"}</Text>
              <Text style={s.editLink}>Ändra</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Statistik</Text>
        <Text style={s.placeholder}>Smakprofil och provningshistorik kommer i framtida uppdateringar.</Text>
      </View>

      <View style={s.section}>
        <Pressable onPress={onSignOut} style={s.signOutBtn}>
          <Text style={s.signOutText}>Logga ut</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ead8ca",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  nameRow: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    color: "#231815",
    fontSize: 18,
    fontWeight: "700",
  },
  editLink: {
    color: "#6f1d1b",
    fontSize: 13,
    fontWeight: "600",
  },
  editRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ead8ca",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#231815",
    fontSize: 16,
    backgroundColor: "#fffaf5",
  },
  saveBtn: {
    backgroundColor: "#6f1d1b",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveBtnText: {
    color: "#fffaf5",
    fontWeight: "700",
    fontSize: 13,
  },
  cancelText: {
    color: "#564a40",
    fontSize: 13,
  },
  sectionTitle: {
    color: "#564a40",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  placeholder: {
    color: "#8f8178",
    fontSize: 13,
    lineHeight: 20,
  },
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: "#6f1d1b",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  signOutText: {
    color: "#6f1d1b",
    fontWeight: "700",
    fontSize: 14,
  },
});
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit src/components/profile-page.tsx 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/profile-page.tsx
git commit -m "feat: add profile page with avatar, inline name editing, and sign out"
```

---

### Task 7: Wire Profile into App.tsx

This task connects everything: adds `useProfile` to CellarScreen, shows the display name prompt when needed, and adds profile page routing.

**Files:**
- Modify: `App.tsx:77-90` (CellarScreen function, hook setup)
- Modify: `App.tsx:174-178` (signOut and profile page state)
- Modify: `App.tsx:225-240` (TastingSessionPanel rendering)
- Modify: `App.tsx:316-362` (return JSX — add prompt overlay + profile page)

- [ ] **Step 1: Add profile imports to App.tsx**

Add these imports at the top of `App.tsx` (after the existing imports around line 38):

```typescript
import { useProfile } from "./src/hooks/useProfile";
import { DisplayNamePrompt } from "./src/components/display-name-prompt";
import { ProfilePage } from "./src/components/profile-page";
```

- [ ] **Step 2: Add profile hook and state to CellarScreen**

In the `CellarScreen` function (around line 78), after `const tastingSessions = useTastingSessions(session.user.id);`, add:

```typescript
  const userProfile = useProfile(session.user.id);
  const [profileVisible, setProfileVisible] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
```

- [ ] **Step 3: Add profile page panel route**

In the `activePanel` block, after the `activeSection === "add"` block (around line 314), add a new condition. Replace the existing `let activePanel = (` block's start — wrap it so that `profileVisible` takes priority. Before `let activePanel = (` (line 179), add:

```typescript
  if (profileVisible && userProfile.profile) {
    const profilePanel = (
      <View style={styles.panel}>
        <ProfilePage
          profile={userProfile.profile}
          onUpdateName={userProfile.updateName}
          onSignOut={signOut}
          onBack={() => setProfileVisible(false)}
        />
      </View>
    );
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scrollFlex}>
          {profilePanel}
        </ScrollView>
        <BottomTabBar activeSection={activeSection} sections={CELLAR_SECTIONS} styles={styles} onSelect={(s) => { setProfileVisible(false); setActiveSection(s); }} />
      </SafeAreaView>
    );
  }
```

- [ ] **Step 4: Replace signOut in MinKallarePanel with profile navigation**

In the `MinKallarePanel` rendering (around line 202), change `onSignOut={signOut}` to:

```typescript
      onSignOut={() => setProfileVisible(true)}
```

This repurposes the "Logga ut" link in MinKallarePanel header to open the profile page instead. The actual sign-out button is now on the profile page.

- [ ] **Step 5: Add display name prompt overlay**

In the CellarScreen return JSX (around line 317), right after `<StatusBar style="light" />` and before `<SuccessOverlay .../>`, add:

```typescript
      <DisplayNamePrompt
        visible={userProfile.needsDisplayName && !promptDismissed}
        saving={false}
        onSave={async (name) => {
          const ok = await userProfile.saveDisplayName(name);
          if (ok) setPromptDismissed(true);
        }}
        onSkip={async () => {
          // Generate "Gäst" + 4 random digits
          const guestName = `Gäst${String(Math.floor(1000 + Math.random() * 9000))}`;
          await userProfile.saveDisplayName(guestName);
          setPromptDismissed(true);
        }}
      />
```

- [ ] **Step 6: Update MinKallarePanel header label**

In the `MinKallarePanel` rendering, change `rightLabel="Logga ut"` to `rightLabel="Profil"` so it reads:

```typescript
      onSignOut={() => setProfileVisible(true)}
```

Wait — `onSignOut` is the prop name. We need to keep the prop name as-is for now (renaming it is a bigger change). Just change the rightLabel text. In `min-kallare-panel.tsx` line 194, the `PanelHeader` call uses the `onSignOut` prop. We pass it from App.tsx. So in App.tsx, just change what it does.

Actually, looking at min-kallare-panel.tsx line 194:
```tsx
<PanelHeader title="Min källare" rightLabel="Logga ut" onRightPress={onSignOut} />
```

The `rightLabel` is hardcoded in min-kallare-panel.tsx. We need to change it there.

In `src/components/min-kallare-panel.tsx`, change line 194 from:
```typescript
      <PanelHeader title="Min källare" rightLabel="Logga ut" onRightPress={onSignOut} />
```
to:
```typescript
      <PanelHeader title="Min källare" rightLabel="Profil" onRightPress={onSignOut} />
```

(The prop is still called `onSignOut` — it now navigates to profile instead. Renaming the prop throughout the component is unnecessary churn for this task.)

- [ ] **Step 7: Verify the app compiles and runs**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -30`

Then start the dev server and verify:
1. Login → display name prompt appears (if display_name is null or contains @)
2. Entering a name → saves to profiles table, prompt disappears
3. Skipping → generates "Gäst1234" name, prompt disappears
4. "Profil" link in Min källare header → opens profile page
5. Profile page shows avatar, display name, edit inline, sign out button

- [ ] **Step 8: Commit**

```bash
git add App.tsx src/components/min-kallare-panel.tsx
git commit -m "feat: wire profile into app — display name prompt, profile page, header link"
```

---

### Task 8: Avatar in Tasting Session Participants

Replace the text-only participant tooltip with avatar circles.

**Files:**
- Modify: `src/components/tasting-session-modal.tsx:360-401` (ParticipantBadge)
- Modify: `src/lib/session-actions.ts:87-91` (fetchSessionParticipants return type)

- [ ] **Step 1: Update fetchSessionParticipants to include avatar_color**

In `src/lib/session-actions.ts`, update the `fetchSessionParticipants` function to return `avatar_color`:

```typescript
export async function fetchSessionParticipants(sessionId: string): Promise<Result<{ user_id: string; display_name: string; avatar_color: string | null }[]>> {
  const { data, error } = await supabase.rpc("get_session_participants", { p_session_id: sessionId });
  if (error) return fail(error.message);
  return ok((data ?? []) as { user_id: string; display_name: string; avatar_color: string | null }[]);
}
```

- [ ] **Step 2: Update the get_session_participants RPC to include avatar_color**

Apply a new migration or update the existing RPC. Create migration:

File: `supabase/migrations/20260402170000_participant_names_avatar_color.sql`

```sql
create or replace function public.get_session_participants(p_session_id uuid)
returns json
language sql security definer
as $$
  select coalesce(json_agg(json_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'avatar_color', p.avatar_color
  )), '[]'::json)
  from profiles p
  where p.id in (
    select distinct st.user_id from session_tastings st where st.session_id = p_session_id
  );
$$;
```

Apply via Supabase MCP.

- [ ] **Step 3: Update ParticipantBadge to use AvatarRow**

In `src/components/tasting-session-modal.tsx`, replace the `ParticipantBadge` function (lines 360-401) with:

```typescript
import { AvatarRow } from "./avatar";

// (add import at top of file)

function ParticipantBadge({ sessionId, count }: { sessionId: string; count: number }) {
  const [participants, setParticipants] = useState<{ user_id: string; display_name: string; avatar_color: string | null }[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function fetchParticipants() {
    if (!fetched) {
      const result = await fetchSessionParticipants(sessionId);
      if (result.data) setParticipants(result.data);
      setFetched(true);
    }
  }

  useEffect(() => { setFetched(false); }, [count]);

  useEffect(() => { fetchParticipants(); }, [sessionId, fetched]);

  return (
    <View>
      <Pressable
        onHoverIn={() => setShowTooltip(true)}
        onHoverOut={() => setShowTooltip(false)}
        onPress={() => setShowTooltip((v) => !v)}
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        {participants.length > 0 ? (
          <AvatarRow participants={participants} size={24} />
        ) : null}
        <Text style={[s.meta, { textDecorationLine: "underline" }]}>{count} deltagare</Text>
      </Pressable>
      {showTooltip && participants.length > 0 ? (
        <View style={s.tooltip}>
          {participants.map((p) => (
            <Text key={p.user_id} style={s.tooltipText}>{p.display_name || "Anonym"}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: Verify the app compiles**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/components/tasting-session-modal.tsx src/lib/session-actions.ts supabase/migrations/20260402170000_participant_names_avatar_color.sql
git commit -m "feat: show avatar circles for session participants instead of text-only"
```

---

### Task 9: Bug Fix — pass wine type to WSET modal in session tasting

Per spec "Scope Boundaries": fix the hardcoded empty string for wine type in session WSET.

**Files:**
- Modify: `App.tsx:335` (WsetTastingModal for sessions)

- [ ] **Step 1: Find the session WSET modal usage**

In `App.tsx` around line 335, the session WSET modal is rendered as:

```tsx
<WsetTastingModal {...sessionWset.wsetProps} />
```

The `wsetProps` doesn't pass `wineType`. Check what `useSessionWset` returns — it should pass the wine type from the active session wine.

Actually, looking at `App.tsx` line 323:
```tsx
<WsetTastingModal {...tasting.wsetProps} wineType={draft.type} />
```
This one (for adding wines) passes `wineType`. But line 335 (for sessions) does not.

We need to pass the wine type from the active session wine being tasted. The session wine has a `type` field.

In `App.tsx`, the session WSET modal is on line 335. We need to know which wine is being tasted. The tasting wine state is inside `TastingSessionPanel` — not accessible from App.tsx.

The cleanest fix: pass `wineType` to `sessionWset` when opening it. Check `useSessionWset`:

Look at `src/hooks/useSessionWset.ts` to understand the interface. The `open` function should accept a wine type.

In `tasting-session-modal.tsx`, the `onOpenWset` callback is called when starting a WSET tasting. We can pass the wine type through.

**Approach:** Add `wineType` state to `useSessionWset`, set it when opening. Then `wsetProps` includes it.

- [ ] **Step 2: Update useSessionWset to accept wineType**

In `src/hooks/useSessionWset.ts`, replace the entire file with:

```typescript
import { useCallback, useState } from "react";
import type { WsetTastingData } from "../lib/wset-data";

export function useSessionWset() {
  const [data, setData] = useState<WsetTastingData | null>(null);
  const [visible, setVisible] = useState(false);
  const [wineType, setWineType] = useState("");

  const wsetProps = {
    visible,
    wineType,
    initialData: data,
    onSave: useCallback((d: WsetTastingData) => { setData(d); setVisible(false); }, []),
    onClose: useCallback(() => setVisible(false), []),
  };

  return {
    data,
    open: useCallback((type?: string) => { setWineType(type || ""); setVisible(true); }, []),
    wsetProps,
  };
}
```

The key change: `open` now accepts an optional `type` parameter and stores it in state. `wsetProps.wineType` reads from that state instead of a hardcoded `""`.

- [ ] **Step 3: Update TastingSessionPanel and SessionTastingView to pass wine type**

In `src/components/tasting-session-modal.tsx`, change the `onOpenWset` prop type (line 42) from:
```typescript
  onOpenWset: () => void;
```
to:
```typescript
  onOpenWset: (wineType?: string) => void;
```

Then in the SessionTastingView usage (line 78), change:
```typescript
          onOpenWset={onOpenWset}
```
to:
```typescript
          onOpenWset={() => onOpenWset(tastingWine.type || "")}
```

In `src/components/session-tasting-view.tsx`, change the `onOpenWset` prop type (line 28) from:
```typescript
  onOpenWset: () => void;
```
to:
```typescript
  onOpenWset: (wineType?: string) => void;
```

Then at line 65 and 70 where `onOpenWset` is called, change both to:
```typescript
onPress={() => onOpenWset(wine.type || "")}
```

(where `wine` is the `SessionWineRow` prop already available as a destructured prop)

- [ ] **Step 4: Verify and commit**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -30`

```bash
git add src/hooks/useSessionWset.ts src/components/tasting-session-modal.tsx src/components/session-tasting-view.tsx
git commit -m "fix: pass wine type to WSET modal in session tasting"
```
