import { supabase } from '@/supabase/client';
import { ensureSession } from '@/supabase/auth';
import { tryCandidate } from '@/engine/generator';
import type { Level } from '@/engine/types';

/**
 * The daily challenge.
 *
 * The seed is derived from the UTC date, so every player in the world gets exactly the
 * same board without the server needing to hand it out - and it still works offline.
 * The leaderboard is the only part that needs a network.
 */

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function seedForDate(date: string): number {
  let hash = 2166136261;
  for (let i = 0; i < date.length; i++) {
    hash ^= date.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Build today's board on the device.
 *
 * This is the one place generation runs at runtime, so it is deliberately kept to a spec
 * that solves in well under a second, and it walks seeds until one succeeds.
 */
export function buildDailyLevel(date = todayKey()): Level | null {
  const base = seedForDate(date);
  const spec = {
    capacity: 4,
    colorCount: 7,
    emptyLanes: 2,
    hiddenMin: 1,
    hiddenMax: 2,
    strategy: 'deal' as const,
  };

  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = tryCandidate(base + attempt * 7919, spec, 250_000);
    if (candidate) {
      return {
        id: -1,
        chapter: 0,
        index: 0,
        seed: candidate.seed,
        config: candidate.config,
        par: candidate.par,
        solution: candidate.solution,
        difficulty: candidate.difficulty,
        beat: 'daily',
        intensity: 0.5,
        note: "Today's board.",
      };
    }
  }
  return null;
}

export interface LeaderboardRow {
  rank: number;
  displayName: string;
  moves: number;
  timeMs: number;
  isSelf: boolean;
}

export async function submitDailyResult(moves: number, timeMs: number): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSession();
  if (!userId) return;

  await supabase
    .from('daily_results')
    .upsert(
      { date: todayKey(), user_id: userId, moves, time_ms: timeMs },
      { onConflict: 'date,user_id' },
    );
}

/**
 * Read the leaderboard through an RPC rather than selecting the table directly, so row
 * level security can stay strict: a player may read only their own row, and the function
 * is the single audited place that returns anybody else's.
 */
export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  if (!supabase) return [];
  const userId = await ensureSession();

  const { data, error } = await supabase.rpc('daily_leaderboard', { for_date: todayKey() });
  if (error || !data) return [];

  return (data as Array<{ rank: number; display_name: string; moves: number; time_ms: number; user_id: string }>).map(
    (row) => ({
      rank: row.rank,
      displayName: row.display_name,
      moves: row.moves,
      timeMs: row.time_ms,
      isSelf: row.user_id === userId,
    }),
  );
}
