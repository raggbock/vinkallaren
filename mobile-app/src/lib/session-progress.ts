import type { SessionTastingRow, SessionWineRow } from "../types/tasting-session";
import { averageRating } from "./session-results";

export type ParticipantProgress = {
  user_id: string;
  tastingCount: number;
  lastTastedAt: string | null;
};

export type WineProgress = {
  wineId: string;
  tastings: SessionTastingRow[];
  participantsDone: Set<string>;
  averageRating: number | null;
};

export function getParticipants(tastings: SessionTastingRow[]): ParticipantProgress[] {
  const map = new Map<string, ParticipantProgress>();
  for (const t of tastings) {
    const existing = map.get(t.user_id);
    if (!existing) {
      map.set(t.user_id, { user_id: t.user_id, tastingCount: 1, lastTastedAt: t.created_at });
    } else {
      existing.tastingCount++;
      if (!existing.lastTastedAt || t.created_at > existing.lastTastedAt) {
        existing.lastTastedAt = t.created_at;
      }
    }
  }
  return Array.from(map.values());
}

export function getWineProgress(
  wines: SessionWineRow[],
  tastings: SessionTastingRow[],
): Map<string, WineProgress> {
  const map = new Map<string, WineProgress>();
  for (const wine of wines) {
    const wineTastings = tastings.filter((t) => t.session_wine_id === wine.id);
    const done = new Set(wineTastings.filter((t) => t.rating != null).map((t) => t.user_id));
    map.set(wine.id, {
      wineId: wine.id,
      tastings: wineTastings,
      participantsDone: done,
      averageRating: averageRating(wineTastings.map((t) => t.rating)),
    });
  }
  return map;
}

export function isAllDone(
  wines: SessionWineRow[],
  tastings: SessionTastingRow[],
  participantCount: number,
): boolean {
  if (wines.length === 0 || participantCount === 0) return false;
  const progress = getWineProgress(wines, tastings);
  for (const wine of wines) {
    const wp = progress.get(wine.id);
    if (!wp || wp.participantsDone.size < participantCount) return false;
  }
  return true;
}
