import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DAILY_HINT_ALLOWANCE, hintsFor } from '@/game/hints';
import { localDay } from '@/game/day';
import { afterSolving, NO_STREAK } from '@/game/streak';

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
  /** The UTC day of the last daily board solved, '' if none. See src/game/streak.ts. */
  dailyLastDay: string;
  dailyStreak: number;
  dailyBest: number;
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
  /** Record that `day`'s daily board was solved. Idempotent on the same board. */
  recordDailySolve: (day: string) => void;
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

/**
 * What survives a relaunch.
 *
 * A new field here has to be added in four places, and the fourth is the one that gets
 * missed: this interface, the initial state, `persist()`'s destructure, and `hydrate()`'s
 * defaulted read - plus `reset()` if Delete my data should clear it.
 *
 * There is deliberately no schema version. `hydrate` reads a `Partial` and defaults every
 * field, so an older save simply arrives without the new keys and gets their defaults; that
 * is the migration, and it holds for any additive change. A version would only start
 * earning its keep if a field's meaning changed, and the key is already versioned by name.
 */
interface Persisted {
  results: Record<number, LevelResult>;
  hintsRemaining: number;
  hintsResetOn: string;
  dailyLastDay: string;
  dailyStreak: number;
  dailyBest: number;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  dirty: number[];
}

export const useProgress = create<ProgressState>((set, get) => {
  function persist(): void {
    const {
      results, hintsRemaining, hintsResetOn, dailyLastDay, dailyStreak, dailyBest,
      hapticsEnabled, soundEnabled, musicEnabled, dirty,
    } = get();
    const payload: Persisted = {
      results,
      hintsRemaining,
      hintsResetOn,
      dailyLastDay,
      dailyStreak,
      dailyBest,
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
    dailyLastDay: NO_STREAK.lastDay,
    dailyStreak: NO_STREAK.current,
    dailyBest: NO_STREAK.best,
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
            dailyLastDay: saved.dailyLastDay ?? NO_STREAK.lastDay,
            dailyStreak: saved.dailyStreak ?? NO_STREAK.current,
            dailyBest: saved.dailyBest ?? NO_STREAK.best,
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

    recordDailySolve: (day) => {
      const { dailyStreak: current, dailyBest: best, dailyLastDay: lastDay } = get();
      const next = afterSolving({ current, best, lastDay }, day);
      if (next.lastDay === lastDay && next.current === current && next.best === best) return;
      set({ dailyStreak: next.current, dailyBest: next.best, dailyLastDay: next.lastDay });
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
      set({
        results: {},
        dirty: [],
        hintsRemaining: DAILY_HINT_ALLOWANCE,
        hintsResetOn: localDay(),
        dailyLastDay: NO_STREAK.lastDay,
        dailyStreak: NO_STREAK.current,
        dailyBest: NO_STREAK.best,
      });
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
