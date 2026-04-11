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
