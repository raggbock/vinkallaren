export type ResultsCtaVariant = "create-account" | "start-own" | null;

/**
 * Which post-tasting CTA to show on the results screen.
 * Host → none (already converted). Anonymous → create account. Else → host your own.
 */
export function resolveResultsCta(opts: { isAnonymous: boolean; isHost: boolean }): ResultsCtaVariant {
  if (opts.isHost) return null;
  if (opts.isAnonymous) return "create-account";
  return "start-own";
}
