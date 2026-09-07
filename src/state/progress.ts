import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local progress is the source of truth. The app is fully playable with no network and
 * no account; Supabase sync merges into this, never the other way round.
 */

const STORAGE_KEY = 'goti.progress.v1';
const DAILY_HINT_ALLOWANCE = 5;

export interface LevelResult {
  stars: number;
  bestMoves: number;
  bestTimeMs: number;
}

export interface ProgressState {
  results: Record<number, LevelResult>;
  hintsRemaining: number;
  hintsResetOn: string;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  loaded: boolean;
  /** Rows changed since the last successful sync. */
  dirty: number[];

  hydrate: () => Promise<void>;
  recordResult: (levelId: number, stars: number, moves: number, timeMs: number) => void;
  spendHint: () => boolean;
  setHaptics: (value: boolean) => void;
  setSound: (value: boolean) => void;
  clearDirty: (ids: number[]) => void;
  reset: () => Promise<void>;

  totalStars: () => number;
  chapterStars: (firstLevelId: number, count: number) => number;
  isUnlocked: (levelId: number, firstLevelId: number) => boolean;
  highestUnlocked: () => number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Persisted {
  results: Record<number, LevelResult>;
  hintsRemaining: number;
  hintsResetOn: string;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  dirty: number[];
}

export const useProgress = create<ProgressState>((set, get) => {
  function persist(): void {
    const { results, hintsRemaining, hintsResetOn, hapticsEnabled, soundEnabled, dirty } = get();
    const payload: Persisted = { results, hintsRemaining, hintsResetOn, hapticsEnabled, soundEnabled, dirty };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
  }

  return {
    results: {},
    hintsRemaining: DAILY_HINT_ALLOWANCE,
    hintsResetOn: today(),
    hapticsEnabled: true,
    soundEnabled: true,
    loaded: false,
    dirty: [],

    hydrate: async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<Persisted>;
          const stale = saved.hintsResetOn !== today();
          set({
            results: saved.results ?? {},
            // Hints refill once a day, at no cost - they are a courtesy, not a currency.
            hintsRemaining: stale ? DAILY_HINT_ALLOWANCE : saved.hintsRemaining ?? DAILY_HINT_ALLOWANCE,
            hintsResetOn: today(),
            hapticsEnabled: saved.hapticsEnabled ?? true,
            soundEnabled: saved.soundEnabled ?? true,
            dirty: saved.dirty ?? [],
          });
        }
      } catch {
        // A corrupt save should cost the player their progress, not the ability to play.
      }
      set({ loaded: true });
    },

    recordResult: (levelId, stars, moves, timeMs) => {
      const existing = get().results[levelId];
      // Only ever improve a record. Replaying a level can never make a score worse.
      const merged: LevelResult = existing
        ? {
            stars: Math.max(existing.stars, stars),
            bestMoves: Math.min(existing.bestMoves, moves),
            bestTimeMs: Math.min(existing.bestTimeMs, timeMs),
          }
        : { stars, bestMoves: moves, bestTimeMs: timeMs };

      const dirty = get().dirty.includes(levelId) ? get().dirty : [...get().dirty, levelId];
      set({ results: { ...get().results, [levelId]: merged }, dirty });
      persist();
    },

    spendHint: () => {
      if (get().hintsRemaining <= 0) return false;
      set({ hintsRemaining: get().hintsRemaining - 1 });
      persist();
      return true;
    },

    setHaptics: (value) => {
      set({ hapticsEnabled: value });
      persist();
    },

    setSound: (value) => {
      set({ soundEnabled: value });
      persist();
    },

    clearDirty: (ids) => {
      set({ dirty: get().dirty.filter((id) => !ids.includes(id)) });
      persist();
    },

    reset: async () => {
      set({ results: {}, dirty: [], hintsRemaining: DAILY_HINT_ALLOWANCE, hintsResetOn: today() });
      await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    },

    totalStars: () => Object.values(get().results).reduce((sum, r) => sum + r.stars, 0),

    chapterStars: (firstLevelId, count) => {
      const results = get().results;
      let total = 0;
      for (let id = firstLevelId; id < firstLevelId + count; id++) total += results[id]?.stars ?? 0;
      return total;
    },

    /**
     * A level opens when the one before it is done. The first level of every chapter is
     * always open, so a player stuck on one puzzle is never stuck on the whole game.
     */
    isUnlocked: (levelId, firstLevelId) => {
      if (levelId === firstLevelId) return true;
      return (get().results[levelId - 1]?.stars ?? 0) > 0;
    },

    highestUnlocked: () => {
      const ids = Object.keys(get().results).map(Number);
      return ids.length === 0 ? 1 : Math.max(...ids) + 1;
    },
  };
});
