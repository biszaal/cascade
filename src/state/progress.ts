import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DAILY_HINT_ALLOWANCE, hintsFor, localDay } from '@/game/hints';

/**
 * Local progress is the source of truth. The app is fully playable with no network and
 * no account; Supabase sync merges into this, never the other way round.
 */

const STORAGE_KEY = 'cascade.progress.v1';

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
  musicEnabled: boolean;
  loaded: boolean;
  /** Rows changed since the last successful sync. */
  dirty: number[];

  hydrate: () => Promise<void>;
  recordResult: (levelId: number, stars: number, moves: number, timeMs: number) => void;
  spendHint: () => boolean;
  /** Refill today's hints if the day has turned since they were last counted. */
  refreshHints: () => void;
  setHaptics: (value: boolean) => void;
  setSound: (value: boolean) => void;
  setMusic: (value: boolean) => void;
  clearDirty: (ids: number[]) => void;
  reset: () => Promise<void>;

  totalStars: () => number;
  chapterStars: (firstLevelId: number, count: number) => number;
  isUnlocked: (levelId: number, firstLevelId: number) => boolean;
  highestUnlocked: () => number;
}

interface Persisted {
  results: Record<number, LevelResult>;
  hintsRemaining: number;
  hintsResetOn: string;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  dirty: number[];
}

export const useProgress = create<ProgressState>((set, get) => {
  function persist(): void {
    const { results, hintsRemaining, hintsResetOn, hapticsEnabled, soundEnabled, musicEnabled, dirty } = get();
    const payload: Persisted = {
      results,
      hintsRemaining,
      hintsResetOn,
      hapticsEnabled,
      soundEnabled,
      musicEnabled,
      dirty,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
  }

  return {
    results: {},
    hintsRemaining: DAILY_HINT_ALLOWANCE,
    hintsResetOn: localDay(),
    hapticsEnabled: true,
    soundEnabled: true,
    musicEnabled: true,
    loaded: false,
    dirty: [],

    hydrate: async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<Persisted>;
          const day = localDay();
          set({
            results: saved.results ?? {},
            hintsRemaining: hintsFor(saved.hintsRemaining, saved.hintsResetOn, day),
            hintsResetOn: day,
            hapticsEnabled: saved.hapticsEnabled ?? true,
            soundEnabled: saved.soundEnabled ?? true,
            musicEnabled: saved.musicEnabled ?? true,
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
      get().refreshHints();
      if (get().hintsRemaining <= 0) return false;
      set({ hintsRemaining: get().hintsRemaining - 1 });
      persist();
      return true;
    },

    refreshHints: () => {
      // Hydrate does its own refill, and persisting before it has run would write an empty
      // profile over the player's saved one.
      if (!get().loaded) return;
      const day = localDay();
      if (get().hintsResetOn === day) return;
      // An app left alive in the background can outlast midnight, so the day is checked
      // again here rather than only at launch.
      set({ hintsRemaining: hintsFor(get().hintsRemaining, get().hintsResetOn, day), hintsResetOn: day });
      persist();
    },

    setHaptics: (value) => {
      set({ hapticsEnabled: value });
      persist();
    },

    setSound: (value) => {
      set({ soundEnabled: value });
      persist();
    },

    setMusic: (value) => {
      set({ musicEnabled: value });
      persist();
    },

    clearDirty: (ids) => {
      set({ dirty: get().dirty.filter((id) => !ids.includes(id)) });
      persist();
    },

    reset: async () => {
      set({ results: {}, dirty: [], hintsRemaining: DAILY_HINT_ALLOWANCE, hintsResetOn: localDay() });
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
