import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  createSession,
  fetchSessionTastings,
  fetchSessionWines,
  joinSessionByCode,
} from "../lib/session-actions";
import type {
  CreateSessionInput,
  SessionTastingRow,
  SessionWineRow,
  TastingSessionRow,
} from "../types/tasting-session";

export function useTastingSessions(userId: string) {
  const [sessions, setSessions] = useState<TastingSessionRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Active session state
  const [activeSession, setActiveSession] = useState<TastingSessionRow | null>(null);
  const [activeWines, setActiveWines] = useState<SessionWineRow[]>([]);
  const [activeTastings, setActiveTastings] = useState<SessionTastingRow[]>([]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasting_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setSessions(data as TastingSessionRow[]);
    setLoading(false);
  }, []);

  const openSession = useCallback(async (session: TastingSessionRow) => {
    setActiveSession(session);
    const [wines, tastings] = await Promise.all([
      fetchSessionWines(session.id),
      fetchSessionTastings(session.id),
    ]);
    setActiveWines(wines);
    setActiveTastings(tastings);
  }, []);

  const closeSession = useCallback(() => {
    setActiveSession(null);
    setActiveWines([]);
    setActiveTastings([]);
  }, []);

  const handleCreate = useCallback(async (input: CreateSessionInput) => {
    const session = await createSession(userId, input);
    if (session) {
      setSessions((prev) => [session, ...prev]);
      await openSession(session);
    }
    return session;
  }, [userId, openSession]);

  const handleJoin = useCallback(async (code: string) => {
    const session = await joinSessionByCode(code);
    if (session) {
      setSessions((prev) => {
        if (prev.some((s) => s.id === session.id)) return prev;
        return [session, ...prev];
      });
      await openSession(session);
    }
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
            setActiveTastings((prev) => [...prev.filter((t) => t.id !== (payload.new as SessionTastingRow).id), payload.new as SessionTastingRow]);
          } else if (payload.eventType === "UPDATE") {
            setActiveTastings((prev) => prev.map((t) => t.id === (payload.new as SessionTastingRow).id ? payload.new as SessionTastingRow : t));
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
          // Re-fetch tastings when revealed (RLS opens up, we now see others' data)
          if (updated.status === "revealed") {
            fetchSessionTastings(sessionId).then(setActiveTastings);
          }
        }
      )
      .subscribe();

    // Also subscribe to new wines added by host
    const winesChannel = supabase
      .channel(`session-wines-${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "session_wines", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setActiveWines((prev) => [...prev, payload.new as SessionWineRow].sort((a, b) => a.position - b.position));
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
