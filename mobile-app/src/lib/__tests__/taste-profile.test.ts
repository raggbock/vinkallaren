jest.mock("../supabase", () => ({ supabase: {} }));

import { buildTasteProfile } from "../taste-profile";
import type { SessionTastingRow, SessionWineRow, TastingSessionRow } from "../../types/tasting-session";

const session = (id: string, status: string, format: "quick" | "wset" = "quick"): TastingSessionRow => ({
  id, host_id: "u1", title: "Test", join_code: "ABC123",
  mode: "blind", format, free_order: false, status: status as any,
  revealed_up_to: 0, created_at: "2026-01-01",
});

const swine = (id: string, sessionId: string): SessionWineRow => ({
  id, session_id: sessionId, position: 1, name: "Wine",
  producer: "Producer", country: "Italien", region: "Piemonte",
  grape: "Nebbiolo", vintage: 2018, type: "Rött", wine_id: null,
  created_at: "2026-01-01",
});

const tasting = (wineId: string, sessionId: string): SessionTastingRow => ({
  id: `t-${wineId}`, session_id: sessionId, session_wine_id: wineId,
  user_id: "u1", rating: 4, notes: null, food_pairings: [],
  tasting_data: null, created_at: "2026-01-01",
});

describe("buildTasteProfile", () => {
  test("not ready with fewer than 2 ended sessions", () => {
    const ended = [session("s1", "ended")];
    const result = buildTasteProfile([], [], [session("s1", "ended")], ended);
    expect(result.ready).toBe(false);
  });

  test("ready with 2+ ended sessions", () => {
    const sessions = [session("s1", "ended"), session("s2", "ended")];
    const wines = [swine("w1", "s1"), swine("w2", "s2")];
    const tastings = [tasting("w1", "s1"), tasting("w2", "s2")];
    const result = buildTasteProfile(tastings, wines, sessions, sessions);
    expect(result.ready).toBe(true);
    expect(result.stats.totalSessions).toBe(2);
    expect(result.stats.totalWines).toBe(2);
  });

  test("history includes all sessions", () => {
    const all = [session("s1", "ended"), session("s2", "active"), session("s3", "ended")];
    const ended = all.filter((s) => s.status === "ended");
    const wines = [swine("w1", "s1"), swine("w2", "s3")];
    const tastings = [tasting("w1", "s1"), tasting("w2", "s3")];
    const result = buildTasteProfile(tastings, wines, all, ended);
    expect(result.history).toHaveLength(3);
  });
});
