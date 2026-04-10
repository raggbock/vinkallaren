import { ok, fail, type Result } from "../types/result";
import { supabase } from "./supabase";
import type {
  CreateSessionInput,
  SessionParticipant,
  SessionTastingInsert,
  SessionWineInsert,
  TastingSessionRow,
  SessionWineRow,
  SessionTastingRow,
} from "../types/tasting-session";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createSession(userId: string, input: CreateSessionInput): Promise<Result<TastingSessionRow>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from("tasting_sessions")
      .insert({ host_id: userId, title: input.title, join_code: joinCode, mode: input.mode, format: input.format, free_order: input.free_order, status: "setup" })
      .select("*")
      .single();
    if (!error) {
      // Auto-join host as participant
      await supabase.from("session_participants").insert({ session_id: data.id, user_id: userId });
      return ok(data as TastingSessionRow);
    }
    if (error.code !== "23505") return fail(error.message);
  }
  return fail("Försök igen.");
}

export async function startSession(sessionId: string): Promise<Result<true>> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "active" }).eq("id", sessionId);
  if (error) return fail(error.message);
  return ok(true);
}

export async function joinSessionByCode(code: string): Promise<Result<TastingSessionRow>> {
  const { data, error } = await supabase.rpc("join_session_by_code", { code: code.toUpperCase() });
  if (error) return fail(error.message);
  if (data?.error) return fail("Ingen aktiv provning med den koden.");
  return ok(data as TastingSessionRow);
}

export async function fetchSessionWines(sessionId: string): Promise<Result<SessionWineRow[]>> {
  const { data, error } = await supabase
    .from("session_wines")
    .select("*")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (error) return fail(error.message);
  return ok((data ?? []) as SessionWineRow[]);
}

export async function fetchSessionTastings(sessionId: string): Promise<Result<SessionTastingRow[]>> {
  const { data, error } = await supabase
    .from("session_tastings")
    .select("*")
    .eq("session_id", sessionId);
  if (error) return fail(error.message);
  return ok((data ?? []) as SessionTastingRow[]);
}

export async function addWineToSession(wine: SessionWineInsert): Promise<Result<SessionWineRow>> {
  const { data, error } = await supabase.from("session_wines").insert(wine).select("*").single();
  if (error) return fail(error.message);
  return ok(data as SessionWineRow);
}

export async function saveTasting(tasting: SessionTastingInsert): Promise<Result<SessionTastingRow>> {
  const { data, error } = await supabase
    .from("session_tastings")
    .upsert(tasting, { onConflict: "session_wine_id,user_id" })
    .select("*")
    .single();
  if (error) return fail(error.message);
  return ok(data as SessionTastingRow);
}

export async function revealSession(sessionId: string): Promise<Result<true>> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "revealing", revealed_up_to: 1 }).eq("id", sessionId);
  if (error) return fail(error.message);
  return ok(true);
}

export async function advanceReveal(sessionId: string, nextPosition: number): Promise<Result<true>> {
  const { error } = await supabase.from("tasting_sessions").update({ revealed_up_to: nextPosition }).eq("id", sessionId);
  if (error) return fail(error.message);
  return ok(true);
}

export async function finishReveal(sessionId: string): Promise<Result<true>> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "ended" }).eq("id", sessionId);
  if (error) return fail(error.message);
  return ok(true);
}

export async function endSession(sessionId: string): Promise<Result<true>> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "ended" }).eq("id", sessionId);
  if (error) return fail(error.message);
  return ok(true);
}

export async function fetchSessionParticipants(sessionId: string): Promise<Result<SessionParticipant[]>> {
  const { data, error } = await supabase.rpc("get_session_participants", { p_session_id: sessionId });
  if (error) return fail(error.message);
  return ok((data ?? []) as SessionParticipant[]);
}

export { shareSession } from "./join-link";

export async function reorderSessionWines(
  sessionId: string,
  wineIds: string[],
): Promise<Result<true>> {
  const updates = wineIds.map((id, i) =>
    supabase.from("session_wines").update({ position: i + 1 }).eq("id", id).eq("session_id", sessionId)
  );
  const results = await Promise.all(updates);
  const err = results.find((r) => r.error);
  if (err?.error) return fail(err.error.message);
  return ok(true);
}

export async function batchAddWinesToSession(
  sessionId: string,
  startPosition: number,
  wines: Array<{ name: string; producer: string | null; vintage: number | null; wine_id: string | null }>,
): Promise<Result<SessionWineRow[]>> {
  const rows = wines.map((w, i) => ({
    session_id: sessionId,
    position: startPosition + i,
    name: w.name,
    producer: w.producer,
    vintage: w.vintage,
    wine_id: w.wine_id,
  }));
  const { data, error } = await supabase.from("session_wines").insert(rows).select();
  if (error) return fail(error.message);
  return ok(data as SessionWineRow[]);
}
