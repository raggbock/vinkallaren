import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { offlineStore, K } from "../lib/offline-store";
import {
  createSession,
  fetchSessionTastings,
  fetchSessionWines,
  joinSessionByCode,
} from "../lib/session-actions";
import type {
  CreateSessionInput,
  SessionTastingRow,
  SessionToast,
  SessionWineRow,
  TastingSessionRow,
} from "../types/tasting-session";

export function useTastingSessions(userId: string) {
  const [sessions, setSessions] = useState<TastingSessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<SessionToast[]>([]);
  const toastIdRef = useRef(0);

  function pushToast(message: string) {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  // Active session state
  const [activeSession, setActiveSession] = useState<TastingSessionRow | null>(null);
  const [activeWines, setActiveWines] = useState<SessionWineRow[]>([]);
  const activeWinesRef = useRef<SessionWineRow[]>([]);
  useEffect(() => { activeWinesRef.current = activeWines; }, [activeWines]);
  const [activeTastings, setActiveTastings] = useState<SessionTastingRow[]>([]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const cached = await offlineStore.get<TastingSessionRow[]>(K.sessions);
    if (cached) setSessions(cached);
    const { data, error } = await supabase
      .from("tasting_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setSessions(data as TastingSessionRow[]);
      await offlineStore.set(K.sessions, data);
    }
    setLoading(false);
  }, []);

  const openSession = useCallback(async (session: TastingSessionRow) => {
    setActiveSession(session);
    const [cachedWines, cachedTastings] = await Promise.all([
      offlineStore.get<SessionWineRow[]>(K.sessionWines(session.id)),
      offlineStore.get<SessionTastingRow[]>(K.sessionTastings(session.id)),
    ]);
    if (cachedWines) setActiveWines(cachedWines);
    if (cachedTastings) setActiveTastings(cachedTastings);

    const [winesResult, tastingsResult] = await Promise.all([
      fetchSessionWines(session.id),
      fetchSessionTastings(session.id),
    ]);
    if (winesResult.data) {
      setActiveWines(winesResult.data);
      await offlineStore.set(K.sessionWines(session.id), winesResult.data);
    }
    if (tastingsResult.data) {
      setActiveTastings(tastingsResult.data);
      await offlineStore.set(K.sessionTastings(session.id), tastingsResult.data);
    }
  }, []);

  const closeSession = useCallback(() => {
    setActiveSession(null);
    setActiveWines([]);
    setActiveTastings([]);
  }, []);

  const handleCreate = useCallback(async (input: CreateSessionInput): Promise<TastingSessionRow | null> => {
    const result = await createSession(userId, input);
    if (result.error) return null;
    const session = result.data!;
    setSessions((prev) => [session, ...prev]);
    await openSession(session);
    return session;
  }, [userId, openSession]);

  const handleJoin = useCallback(async (code: string): Promise<TastingSessionRow | null> => {
    const result = await joinSessionByCode(code);
    if (result.error) return null;
    const session = result.data!;
    setSessions((prev) => {
      if (prev.some((s) => s.id === session.id)) return prev;
      return [session, ...prev];
    });
    await openSession(session);
    return session;
  }, [openSession]);

  // Realtime: subscribe to tastings + session status when a session is open
  useEffect(() => {
    if (!activeSession) return;
    const sessionId = activeSession.id;

    const tastingsChannel = supabase
      .channel(`session-tastings-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_tastings", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const tasting = payload.new as SessionTastingRow;
            setActiveTastings((prev) => {
              const next = [...prev.filter((t) => t.id !== tasting.id), tasting];
              const isNewParticipant = !prev.some((t) => t.user_id === tasting.user_id);
              if (isNewParticipant && tasting.user_id !== userId) pushToast("Ny deltagare gick med!");

              // Check if all participants have now tasted this wine
              if (tasting.rating != null && tasting.user_id !== userId) {
                const participants = new Set(next.map((t) => t.user_id));
                const wineTastings = next.filter((t) => t.session_wine_id === tasting.session_wine_id && t.rating != null);
                if (wineTastings.length === participants.size && participants.size > 1) {
                  const wineName = activeWinesRef.current.find((w) => w.id === tasting.session_wine_id)?.name;
                  if (wineName) pushToast(`Alla har smakat ${wineName}`);
                }
              }
              return next;
            });
          } else if (payload.eventType === "UPDATE") {
            const tasting = payload.new as SessionTastingRow;
            if (tasting.user_id !== userId && tasting.rating != null) {
              pushToast("Någon har smakat klart på ett vin");
            }
            setActiveTastings((prev) => prev.map((t) => t.id === tasting.id ? tasting : t));
          } else if (payload.eventType === "DELETE") {
            setActiveTastings((prev) => prev.filter((t) => t.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();

    const sessionChannel = supabase
      .channel(`session-status-${sessionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasting_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as TastingSessionRow;
          setActiveSession(updated);
          setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
          // Re-fetch tastings when status changes or reveal advances (RLS opens up progressively)
          if (updated.status !== "active") {
            fetchSessionTastings(sessionId).then((r) => { if (r.data) setActiveTastings(r.data); });
          }
        }
      )
      .subscribe();

    // Also subscribe to new wines added by host
    const winesChannel = supabase
      .channel(`session-wines-${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "session_wines", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const wine = payload.new as SessionWineRow;
          setActiveWines((prev) => prev.some((w) => w.id === wine.id) ? prev : [...prev, wine].sort((a, b) => a.position - b.position));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tastingsChannel);
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(winesChannel);
    };
  }, [activeSession?.id]);

  return {
    sessions,
    loading,
    toasts,
    activeSession,
    activeWines,
    activeTastings,
    fetchSessions,
    openSession,
    closeSession,
    createSession: handleCreate,
    joinSession: handleJoin,
    setActiveWines,
    setActiveTastings,
    setActiveSession,
  };
}
