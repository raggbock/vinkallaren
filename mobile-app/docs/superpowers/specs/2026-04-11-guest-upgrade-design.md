# Spec: Guest → Real Account Upgrade

**Date:** 2026-04-11
**Status:** Approved

## Summary

Let anonymous (guest) users upgrade to a real email+password account without losing data. Triggered naturally when they try to add more wines.

## Trigger Logic

- **At wine #3 (soft prompt):** "Skapa ett konto för att inte förlora dina viner" — dismissable with "Inte nu"
- **At wine #6 (hard block):** "Du behöver ett konto för att lägga till fler viner" — cannot dismiss, must create account
- Prompts only shown for anonymous users (`session.user.is_anonymous === true`)
- Soft prompt dismissed state persists for the session (useState), resets on next app load

## Upgrade Method

Use Supabase's built-in anonymous upgrade: `supabase.auth.updateUser({ email, password })`.

This converts the anonymous session to a real auth session while keeping the same `user_id`. All existing data (wines, history, tastings, storage spaces) stays linked automatically — no data migration needed.

After successful upgrade, `session.user.is_anonymous` becomes `false` and the gate stops triggering.

## Detecting Anonymous Users

Supabase sets `session.user.is_anonymous === true` on anonymous sessions. No database changes needed.

## Component Structure

### New files

| File | Purpose | Est. lines |
|------|---------|------------|
| `src/components/upgrade-prompt.tsx` | Modal with email + password form | ~100 |
| `src/hooks/useGuestGate.ts` | Checks is_anonymous + wine count, returns gate state | ~30 |

### Modified files

| File | Change |
|------|--------|
| `src/components/add-wine-tab.tsx` | Call `useGuestGate`, show `UpgradePrompt` before saving wine |

## useGuestGate Hook

```typescript
interface GuestGateResult {
  shouldPrompt: boolean;  // true at wine count >= 2 (about to add #3)
  isBlocked: boolean;     // true at wine count >= 5 (about to add #6)
  dismiss: () => void;    // dismiss soft prompt for this session
  isAnonymous: boolean;   // whether user is anonymous
}
```

Input: `session.user.is_anonymous` and `wines.length` from CellarContext.

Logic:
- If not anonymous → `{ shouldPrompt: false, isBlocked: false }`
- If anonymous and wines.length >= 5 → `{ isBlocked: true, shouldPrompt: true }`
- If anonymous and wines.length >= 2 and not dismissed → `{ shouldPrompt: true, isBlocked: false }`
- If dismissed → `{ shouldPrompt: false, isBlocked: false }` (until next app load)

## UpgradePrompt Component

Modal styled like `DisplayNamePrompt` (same panel style, not fullscreen).

Fields:
- Email (TextInput, keyboardType="email-address")
- Lösenord (TextInput, secureTextEntry)

Buttons:
- "Skapa konto" (primary) — calls `supabase.auth.updateUser({ email, password })`
- "Inte nu" (secondary, only when `!isBlocked`) — calls `dismiss()`

Validation:
- Email must contain "@"
- Password must be >= 6 characters
- Both fields required

Copy:
- Soft mode: "Skapa ett konto för att inte förlora dina viner"
- Hard mode: "Du behöver ett konto för att lägga till fler viner"

## Error Handling

- Email already registered: Show "Den här e-postadressen används redan"
- Weak password: Show Supabase's error message
- Network error: Show via `showError`
- After success: Close modal, show `success.show("account_created")`

## Flow in AddWineTab

When user tries to save a wine:
1. `useGuestGate` checks anonymous status + wine count
2. If `shouldPrompt || isBlocked` → show `UpgradePrompt` instead of saving
3. If user upgrades → close prompt, proceed to save wine
4. If user dismisses (soft only) → proceed to save wine
5. If blocked → cannot proceed without upgrading

## What This Does NOT Include

- Stale guest cleanup (separate task #9)
- Magic link / OAuth upgrade options
- Display name prompt during upgrade (existing DisplayNamePrompt handles this separately)
- Changes to landing page or login flow
