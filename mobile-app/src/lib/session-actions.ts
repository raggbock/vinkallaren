import { Alert } from "react-native";
import { supabase } from "./supabase";
import type {
  CreateSessionInput,
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

export async function createSession(userId: string, input: CreateSessionInput): Promise<TastingSessionRow | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from("tasting_sessions")
      .insert({ host_id: userId, title: input.title, join_code: joinCode, mode: input.mode, format: input.format, free_order: input.free_order })
      .select("*")
      .single();
    if (!error) return data as TastingSessionRow;
    if (error.code !== "23505") { Alert.alert("Kunde inte skapa provning", error.message); return null; }
  }
  Alert.alert("Kunde inte skapa provning", "Försök igen.");
  return null;
}

export async function joinSessionByCode(code: string): Promise<TastingSessionRow | null> {
  const { data, error } = await supabase.rpc("join_session_by_code", { code: code.toUpperCase() });
  if (error) { Alert.alert("Kunde inte gå med", error.message); return null; }
  if (data?.error) { Alert.alert("Hittades inte", "Ingen aktiv provning med den koden."); return null; }
  return data as TastingSessionRow;
}

export async function fetchSessionWines(sessionId: string): Promise<SessionWineRow[]> {
  const { data, error } = await supabase
    .from("session_wines")
    .select("*")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (error) { Alert.alert("Kunde inte hämta viner", error.message); return []; }
  return (data ?? []) as SessionWineRow[];
}

export async function fetchSessionTastings(sessionId: string): Promise<SessionTastingRow[]> {
  const { data, error } = await supabase
    .from("session_tastings")
    .select("*")
    .eq("session_id", sessionId);
  if (error) { Alert.alert("Kunde inte hämta provningar", error.message); return []; }
  return (data ?? []) as SessionTastingRow[];
}

export async function addWineToSession(wine: SessionWineInsert): Promise<SessionWineRow | null> {
  const { data, error } = await supabase.from("session_wines").insert(wine).select("*").single();
  if (error) { Alert.alert("Kunde inte lägga till vin", error.message); return null; }
  return data as SessionWineRow;
}

export async function saveTasting(tasting: SessionTastingInsert): Promise<SessionTastingRow | null> {
  const { data, error } = await supabase
    .from("session_tastings")
    .upsert(tasting, { onConflict: "session_wine_id,user_id" })
    .select("*")
    .single();
  if (error) { Alert.alert("Kunde inte spara provning", error.message); return null; }
  return data as SessionTastingRow;
}

export async function revealSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "revealed" }).eq("id", sessionId);
  if (error) { Alert.alert("Kunde inte avslöja", error.message); return false; }
  return true;
}

export async function endSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "ended" }).eq("id", sessionId);
  if (error) { Alert.alert("Kunde inte avsluta", error.message); return false; }
  return true;
}

export function buildShareMessage(title: string, joinCode: string): string {
  return `Vinprovning: ${title} — Gå med med kod: ${joinCode}`;
}
