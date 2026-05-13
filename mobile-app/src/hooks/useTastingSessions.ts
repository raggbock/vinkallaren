import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { offlineStore, K } from "../lib/offline-store";
import { useOnlineStatus } from "./useOnlineStatus";
import {
  createSession,
  fetchSessionById,
  fetchSessionOverview,
  joinSessionByCode,
  queueSaveTasting,
} from "../lib/session-actions";
import type {
  CreateSessionInput,
  SessionDishRow,
  SessionParticipant,
  SessionTastingDishRow,
  SessionTastingInsert,
  SessionTastingRow,
  SessionToast,
  SessionWineRow,
  TastingSessionRow,
} from "../types/tasting-session";

const SESSIONS_PAGE_SIZE = 30;

export function useTastingSessions(userId: string) {
  const { online } = useOnlineStatus();
  const [sessions, setSessions] = useState<TastingSessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
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
  const [activeParticipants, setActiveParticipants] = useState<SessionParticipant[]>([]);
  const [activeDishes, setActiveDishes] = useState<SessionDishRow[]>([]);
  const [activeTastingDishes, setActiveTastingDishes] = useState<SessionTastingDishRow[]>([]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const cached = await offlineStore.get<TastingSessionRow[]>(K.sessions);
    if (cached) setSessions(cached);
    const { data, error } = await supabase
      .from("tasting_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(SESSIONS_PAGE_SIZE);
    if (!error && data) {
      const rows = data as TastingSessionRow[];
      setSessions(rows);
      setHasMore(rows.length === SESSIONS_PAGE_SIZE);
      await offlineStore.set(K.sessions, rows);
    }
    setLoading(false);
  }, []);

  const fetchMoreSessions = useCallback(async () => {
    if (!hasMore) return;
    const offset = sessions.length;
    const { data, error } = await supabase
      .from("tasting_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + SESSIONS_PAGE_SIZE - 1);
    if (error || !data) return;
    const rows = data as TastingSessionRow[];
    setHasMore(rows.length === SESSIONS_PAGE_SIZE);
    setSessions((prev) => {
      const seen = new Set(prev.map((s) => s.id));
      return [...prev, ...rows.filter((r) => !seen.has(r.id))];
    });
  }, [hasMore, sessions.length]);

  const openSession = useCallback(async (session: TastingSessionRow) => {
    setActiveSession(session);
    const [cachedWines, cachedTastings] = await Promise.all([
      offlineStore.get<SessionWineRow[]>(K.sessionWines(session.id)),
      offlineStore.get<SessionTastingRow[]>(K.sessionTastings(session.id)),
    ]);
    if (cachedWines) setActiveWines(cachedWines);
    if (cachedTastings) setActiveTastings(cachedTastings);

    const result = await fetchSessionOverview(session.id);
    if (result.data) {
      setActiveWines(result.data.wines);
      setActiveTastings(result.data.tastings);
      setActiveParticipants(result.data.participants);
      setActiveDishes(result.data.dishes);
      setActiveTastingDishes(result.data.tasting_dishes);
      await Promise.all([
        offlineStore.set(K.sessionWines(session.id), result.data.wines),
        offlineStore.set(K.sessionTastings(session.id), result.data.tastings),
      ]);
    }
  }, []);

  const openSessionById = useCallback(async (sessionId: string) => {
    const cached = sessions.find((s) => s.id === sessionId);
    if (cached) { await openSession(cached); return cached; }
    const r = await fetchSessionById(sessionId);
    if (r.error || !r.data) return null;
    setSessions((prev) => prev.some((s) => s.id === r.data!.id) ? prev : [r.data!, ...prev]);
    await openSession(r.data);
    return r.data;
  }, [sessions, openSession]);

  const closeSession = useCallback(() => {
    setActiveSession(null);
    setActiveWines([]);
    setActiveTastings([]);
    setActiveParticipants([]);
    setActiveDishes([]);
    setActiveTastingDishes([]);
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
    const { session, overview } = result.data!;
    setSessions((prev) => prev.some((s) => s.id === session.id) ? prev : [session, ...prev]);
    setActiveSession(session);
    if (overview) {
      setActiveWines(overview.wines);
      setActiveTastings(overview.tastings);
      setActiveParticipants(overview.participants);
      setActiveDishes(overview.dishes);
      setActiveTastingDishes(overview.tasting_dishes);
      await Promise.all([
        offlineStore.set(K.sessionWines(session.id), overview.wines),
        offlineStore.set(K.sessionTastings(session.id), overview.tastings),
      ]);
    } else {
      await openSession(session);
    }
    return session;
  }, [openSession]);

  const saveTastingOptimistic = useCallback(async (row: SessionTastingInsert) => {
    setActiveTastings((prev) => {
      const existing = prev.find(
        (t) => t.session_wine_id === row.session_wine_id && t.user_id === row.user_id,
      );
      const merged = {
        ...(existing ?? {
          id: `local-${Date.now()}`,
          created_at: new Date().toISOString(),
        }),
        ...row,
      } as SessionTastingRow;
      const next = existing
        ? prev.map((t) => (t === existing ? merged : t))
        : [...prev, merged];
      if (row.session_id) {
        offlineStore.set(K.sessionTastings(row.session_id), next);
      }
      return next;
    });
    await queueSaveTasting(row);
  }, []);

  // Realtime: subscribe to tastings + session status when a session is open
  useEffect(() => {
    if (!activeSession) return;
    if (!online) return;
    const sessionId = activeSession.id;

    const persist = (next: SessionTastingRow[]) => {
      void offlineStore.set(K.sessionTastings(sessionId), next);
    };
    const tastingsChannel = supabase
      .channel(`session-tastings-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_tastings", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const tasting = payload.new as SessionTastingRow;
            setActiveTastings((prev) => {
              const next = [...prev.filter((t) => t.id !== tasting.id), tasting];
              persist(next);
              if (tasting.user_id !== userId && tasting.rating != null) {
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
            setActiveTastings((prev) => {
              const next = prev.map((t) => t.id === tasting.id ? tasting : t);
              persist(next);
              return next;
            });
          } else if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            setActiveTastings((prev) => {
              const next = prev.filter((t) => t.id !== id);
              persist(next);
              return next;
            });
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
            fetchSessionOverview(sessionId).then((r) => { if (r.data) setActiveTastings(r.data.tastings); });
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
          setActiveWines((prev) => {
            if (prev.some((w) => w.id === wine.id)) return prev;
            const next = [...prev, wine].sort((a, b) => a.position - b.position);
            void offlineStore.set(K.sessionWines(sessionId), next);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tastingsChannel);
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(winesChannel);
    };
  }, [activeSession?.id, online]);

  // Reconcile local state on reconnect
  useEffect(() => {
    if (!online || !activeSession) return;
    fetchSessionOverview(activeSession.id).then((r) => {
      if (!r.data) return;
      setActiveTastings(r.data.tastings);
      setActiveParticipants(r.data.participants);
      setActiveDishes(r.data.dishes);
      setActiveTastingDishes(r.data.tasting_dishes);
      void offlineStore.set(K.sessionTastings(activeSession.id), r.data.tastings);
    });
  }, [online, activeSession?.id]);

  return {
    sessions,
    loading,
    hasMoreSessions: hasMore,
    toasts,
    pushToast,
    activeSession,
    activeWines,
    activeTastings,
    activeParticipants,
    activeDishes,
    activeTastingDishes,
    setActiveParticipants,
    setActiveDishes,
    setActiveTastingDishes,
    fetchSessions,
    fetchMoreSessions,
    openSession,
    openSessionById,
    closeSession,
    createSession: handleCreate,
    joinSession: handleJoin,
    setActiveWines,
    setActiveTastings,
    setActiveSession,
    saveTastingOptimistic,
  };
}
