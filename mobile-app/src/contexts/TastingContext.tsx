import { createContext, useContext, type ReactNode } from "react";
import { useTastingSessions } from "../hooks/useTastingSessions";
import { useSessionWset } from "../hooks/useSessionWset";
import type { WsetTastingData } from "../lib/wset-data";
import type { CreateSessionInput, SessionTastingRow, SessionWineRow, SessionToast, TastingSessionRow } from "../types/tasting-session";

export type TastingContextValue = {
  sessions: TastingSessionRow[];
  loading: boolean;
  toasts: SessionToast[];
  activeSession: TastingSessionRow | null;
  activeWines: SessionWineRow[];
  activeTastings: SessionTastingRow[];
  fetchSessions: () => void;
  openSession: (session: TastingSessionRow) => void;
  closeSession: () => void;
  createSession: (input: CreateSessionInput) => Promise<TastingSessionRow | null>;
  joinSession: (code: string) => Promise<TastingSessionRow | null>;
  setActiveWines: (fn: (prev: SessionWineRow[]) => SessionWineRow[]) => void;
  setActiveTastings: (fn: (prev: SessionTastingRow[]) => SessionTastingRow[]) => void;
  setActiveSession: (session: TastingSessionRow | null) => void;
  // WSET
  wsetData: WsetTastingData | null;
  openWset: (wineType?: string) => void;
  wsetProps: { visible: boolean; onClose: () => void; onSave: (data: WsetTastingData) => void; wineType: string; initialData: WsetTastingData | null };
};

const TastingContext = createContext<TastingContextValue | null>(null);

export function useTasting(): TastingContextValue {
  const ctx = useContext(TastingContext);
  if (!ctx) throw new Error("useTasting must be used inside TastingProvider");
  return ctx;
}

export function TastingProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const sessions = useTastingSessions(userId);
  const wset = useSessionWset();

  const value: TastingContextValue = {
    sessions: sessions.sessions,
    loading: sessions.loading,
    toasts: sessions.toasts,
    activeSession: sessions.activeSession,
    activeWines: sessions.activeWines,
    activeTastings: sessions.activeTastings,
    fetchSessions: sessions.fetchSessions,
    openSession: sessions.openSession,
    closeSession: sessions.closeSession,
    createSession: sessions.createSession,
    joinSession: sessions.joinSession,
    setActiveWines: sessions.setActiveWines,
    setActiveTastings: sessions.setActiveTastings,
    setActiveSession: sessions.setActiveSession,
    wsetData: wset.data,
    openWset: wset.open,
    wsetProps: wset.wsetProps,
  };

  return <TastingContext.Provider value={value}>{children}</TastingContext.Provider>;
}
