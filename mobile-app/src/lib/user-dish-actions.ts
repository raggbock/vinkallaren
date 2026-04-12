import { ok, fail, type Result } from "../types/result";
import { supabase } from "./supabase";
import type { UserDishRow } from "../types/user-dish";

export async function fetchUserDishes(): Promise<Result<UserDishRow[]>> {
  const { data, error } = await supabase
    .from("user_dishes")
    .select("*")
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) return fail(error.message);
  return ok((data ?? []) as UserDishRow[]);
}

export async function addUserDish(name: string, category: string | null): Promise<Result<UserDishRow>> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("user_dishes")
    .upsert({ user_id: userData.user?.id, name, category }, { onConflict: "user_id,name" })
    .select("*")
    .single();
  if (error) return fail(error.message);
  return ok(data as UserDishRow);
}

export async function deleteUserDish(dishId: string): Promise<Result<true>> {
  const { error } = await supabase.from("user_dishes").delete().eq("id", dishId);
  if (error) return fail(error.message);
  return ok(true);
}
