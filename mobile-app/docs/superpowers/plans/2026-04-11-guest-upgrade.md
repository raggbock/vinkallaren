# Guest → Real Account Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anonymous guests upgrade to a real email+password account, triggered when they try to add their 3rd wine (soft) or 6th wine (hard block).

**Architecture:** A `useGuestGate` hook checks `session.user.is_anonymous` + wine count and returns gate state. An `UpgradePrompt` modal collects email+password and calls `supabase.auth.updateUser()`. The gate is checked in `AddWineTab` before saving a wine.

**Tech Stack:** React Native, TypeScript, Supabase Auth (`updateUser`)

---

### Task 1: Create useGuestGate hook

**Files:**
- Create: `src/hooks/useGuestGate.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState } from "react";

const SOFT_LIMIT = 2;  // prompt when about to add wine #3
const HARD_LIMIT = 5;  // block when about to add wine #6

interface GuestGateResult {
  shouldPrompt: boolean;
  isBlocked: boolean;
  dismiss: () => void;
  isAnonymous: boolean;
}

export function useGuestGate(isAnonymous: boolean, wineCount: number): GuestGateResult {
  const [dismissed, setDismissed] = useState(false);

  if (!isAnonymous) {
    return { shouldPrompt: false, isBlocked: false, dismiss: () => {}, isAnonymous: false };
  }

  const isBlocked = wineCount >= HARD_LIMIT;
  const shouldPrompt = isBlocked || (wineCount >= SOFT_LIMIT && !dismissed);

  return {
    shouldPrompt,
    isBlocked,
    dismiss: () => setDismissed(true),
    isAnonymous: true,
  };
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGuestGate.ts
git commit -m "feat: add useGuestGate hook for anonymous user wine limits"
```

---

### Task 2: Create UpgradePrompt component

**Files:**
- Create: `src/components/upgrade-prompt.tsx`

- [ ] **Step 1: Create the component**

Style it identically to `DisplayNamePrompt` (same overlay, card, input, button styles). The component uses `supabase.auth.updateUser({ email, password })` to convert the anonymous session.

```typescript
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../styles/theme";
import { supabase } from "../lib/supabase";

type UpgradePromptProps = {
  visible: boolean;
  isBlocked: boolean;
  onUpgraded: () => void;
  onDismiss: () => void;
};

export function UpgradePrompt({ visible, isBlocked, onUpgraded, onDismiss }: UpgradePromptProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const canSave = email.includes("@") && password.length >= 6;

  async function handleUpgrade() {
    setSaving(true);
    setError(null);
    const { error: authError } = await supabase.auth.updateUser({ email, password });
    setSaving(false);
    if (authError) {
      if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
        setError("Den här e-postadressen används redan");
      } else {
        setError(authError.message);
      }
      return;
    }
    onUpgraded();
  }

  return (
    <View style={s.overlay}>
      <View style={s.card}>
        <Text style={s.title}>
          {isBlocked ? "Skapa ett konto" : "Spara dina viner"}
        </Text>
        <Text style={s.subtitle}>
          {isBlocked
            ? "Du behöver ett konto för att lägga till fler viner."
            : "Skapa ett konto för att inte förlora dina viner."}
        </Text>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="E-post"
          placeholderTextColor={colors.textSecondary}
          autoFocus
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Lösenord (minst 6 tecken)"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Pressable
          onPress={handleUpgrade}
          style={[s.primaryBtn, !canSave && s.disabled]}
          disabled={!canSave || saving}
        >
          <Text style={s.primaryBtnText}>{saving ? "Skapar..." : "Skapa konto"}</Text>
        </Pressable>
        {!isBlocked ? (
          <Pressable onPress={onDismiss} disabled={saving}>
            <Text style={s.skipText}>Inte nu</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(26, 15, 14, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 380,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  error: {
    color: colors.accent,
    fontSize: 13,
    textAlign: "center",
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  primaryBtn: {
    backgroundColor: colors.warm,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  disabled: {
    opacity: 0.4,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
});
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/upgrade-prompt.tsx
git commit -m "feat: add UpgradePrompt component for guest account upgrade"
```

---

### Task 3: Wire gate into AddWineTab

**Files:**
- Modify: `src/components/add-wine-tab.tsx`

- [ ] **Step 1: Add imports**

Add at the top of `add-wine-tab.tsx`:

```typescript
import { useGuestGate } from "../hooks/useGuestGate";
import { UpgradePrompt } from "./upgrade-prompt";
import { useCellar } from "../contexts/CellarContext";
```

Note: `useCellar` may already be imported — check first. If not, add it.

- [ ] **Step 2: Add isAnonymous to AddWineTabProps**

Add `isAnonymous: boolean` to the `AddWineTabProps` type:

```typescript
export type AddWineTabProps = {
  hidden: boolean;
  onOpenProfile: () => void;
  onNavigateToCellar: () => void;
  catalogData: ReturnType<typeof useCatalog>;
  refOptions: ReturnType<typeof useReferenceOptions>;
  images: ReturnType<typeof useImagePicker>;
  storageData: ReturnType<typeof useStorageSpaces>;
  storage: ReturnType<typeof useStorageSelection>;
  success: ReturnType<typeof useSuccessOverlay>;
  wineData: Pick<ReturnType<typeof useWines>, "wines" | "setWines">;
  historyData: Pick<ReturnType<typeof useHistory>, "setHistoryEntries">;
  sessionUserId: string;
  isAnonymous: boolean;
};
```

- [ ] **Step 3: Add gate logic inside AddWineTabContent**

Inside `AddWineTabContent`, after the existing hooks (around line 92), add:

```typescript
const ctx = useCellar();
const gate = useGuestGate(isAnonymous, ctx.wines.length);
```

Note: Add `isAnonymous` to the destructured props of `AddWineTabContent`.

- [ ] **Step 4: Wrap handleSaveWine with gate check**

Replace the `onSaveWine={handleSaveWine}` prop on `AddWinePanel` with a gated version:

```typescript
onSaveWine={() => {
  if (gate.shouldPrompt) return; // UpgradePrompt is showing, don't save
  handleSaveWine();
}}
```

- [ ] **Step 5: Add UpgradePrompt to the render**

Inside the return JSX, add `UpgradePrompt` before the `<Suspense>` block:

```typescript
<UpgradePrompt
  visible={gate.shouldPrompt}
  isBlocked={gate.isBlocked}
  onUpgraded={() => handleSaveWine()}
  onDismiss={() => { gate.dismiss(); handleSaveWine(); }}
/>
```

- [ ] **Step 6: Pass isAnonymous from App.tsx**

In `App.tsx`, find where `AddWineTab` is rendered and add the `isAnonymous` prop:

```typescript
<AddWineTab
  hidden={false}
  onOpenProfile={() => setProfileVisible(true)}
  onNavigateToCellar={() => setActiveSection("cellar")}
  catalogData={catalogData}
  refOptions={refOptions}
  images={images}
  storageData={storageData}
  storage={storage}
  success={success}
  wineData={{ wines: wineData.wines, setWines: wineData.setWines }}
  historyData={{ setHistoryEntries: historyData.setHistoryEntries }}
  sessionUserId={session.user.id}
  isAnonymous={session.user.is_anonymous ?? false}
/>
```

- [ ] **Step 7: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/add-wine-tab.tsx App.tsx
git commit -m "feat: gate wine saving behind guest upgrade prompt"
```

---

### Task 4: Build, verify, and push

**Files:** None (verification only)

- [ ] **Step 1: Build**

Run: `npm run web:build`
Expected: Build succeeds

- [ ] **Step 2: Push**

```bash
git push
```
