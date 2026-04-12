import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchUserDishes, addUserDish, deleteUserDish } from "../lib/user-dish-actions";
import type { UserDishRow } from "../types/user-dish";

export function useUserDishes() {
  const [dishes, setDishes] = useState<UserDishRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserDishes().then((r) => {
      if (r.data) setDishes(r.data);
      setLoading(false);
    });
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const d of dishes) {
      const cat = d.category || "Mina rätter";
      const arr = map.get(cat) ?? [];
      arr.push(d.name);
      map.set(cat, arr);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  }, [dishes]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const d of dishes) {
      if (d.category) cats.add(d.category);
    }
    return [...cats].sort();
  }, [dishes]);

  const handleAdd = useCallback(async (name: string, category: string | null) => {
    const r = await addUserDish(name.trim(), category?.trim() || null);
    if (r.data) setDishes((prev) => [...prev.filter((d) => d.name.toLowerCase() !== name.trim().toLowerCase()), r.data!]);
    return r;
  }, []);

  const handleDelete = useCallback(async (dishId: string) => {
    const r = await deleteUserDish(dishId);
    if (r.data) setDishes((prev) => prev.filter((d) => d.id !== dishId));
  }, []);

  return { dishes, groups, categories, loading, addDish: handleAdd, deleteDish: handleDelete };
}
