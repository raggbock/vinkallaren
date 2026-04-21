import { supabase } from "./supabase";
import type { Handlers } from "./sync-queue";

export const supabaseHandlers: Handlers = {
  upsert_session_tasting: async (payload) => {
    const { error } = await supabase
      .from("session_tastings")
      .upsert(payload, { onConflict: "session_wine_id,user_id" });
    return error ? { ok: false, error: error.message } : { ok: true };
  },
  create_session: async (payload) => {
    const { error } = await supabase.from("tasting_sessions").insert(payload);
    return error ? { ok: false, error: error.message } : { ok: true };
  },
  add_session_wine: async (payload) => {
    const { error } = await supabase.from("session_wines").insert(payload);
    return error ? { ok: false, error: error.message } : { ok: true };
  },
  submit_wset: async (payload) => {
    const { error } = await supabase
      .from("session_tastings")
      .upsert(payload, { onConflict: "session_wine_id,user_id" });
    return error ? { ok: false, error: error.message } : { ok: true };
  },
};
