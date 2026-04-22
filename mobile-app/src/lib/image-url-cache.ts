import { supabase } from "./supabase";

const TTL_MS = 55 * 60 * 1000;
const MAX_ENTRIES = 500;

type Entry = { url: string; expiresAt: number };
const cache = new Map<string, Entry>();

function prune() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export async function getSignedImageUrls(paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const now = Date.now();
  const missing: string[] = [];

  for (const path of paths) {
    const hit = cache.get(path);
    if (hit && hit.expiresAt > now) {
      result.set(path, hit.url);
      cache.delete(path);
      cache.set(path, hit);
    } else {
      missing.push(path);
    }
  }

  if (missing.length === 0) return result;

  const { data } = await supabase.storage.from("wine-images").createSignedUrls(missing, 60 * 60);
  const expiresAt = now + TTL_MS;
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) {
      cache.set(entry.path, { url: entry.signedUrl, expiresAt });
      result.set(entry.path, entry.signedUrl);
    }
  }
  prune();
  return result;
}

export function invalidateImageUrl(path: string) {
  cache.delete(path);
}

export function clearImageUrlCache() {
  cache.clear();
}
