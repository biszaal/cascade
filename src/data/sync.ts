import { supabase } from '@/supabase/client';
import { ensureSession } from '@/supabase/auth';
import { useProgress } from '@/state/progress';

/**
 * Push local results to Supabase.
 *
 * Local storage is the source of truth. Sync is strictly best-effort: every entry point
 * here swallows its errors, because a player on a train must never notice that the
 * network went away.
 */

export interface ResultPayload {
  levelId: number;
  stars: number;
  moves: number;
  timeMs: number;
}

export async function queueResultSync(result: ResultPayload): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSession();
  if (!userId) return;

  const { error } = await supabase.from('level_results').upsert(
    {
      user_id: userId,
      level_id: result.levelId,
      best_moves: result.moves,
      stars: result.stars,
      best_time_ms: result.timeMs,
    },
    { onConflict: 'user_id,level_id' },
  );

  if (!error) useProgress.getState().clearDirty([result.levelId]);
}

/** Flush everything recorded while offline. Called on launch and when sync is retried. */
export async function flushPending(): Promise<void> {
  if (!supabase) return;
  const { dirty, results } = useProgress.getState();
  if (dirty.length === 0) return;

  const userId = await ensureSession();
  if (!userId) return;

  const rows = dirty
    .map((levelId) => {
      const result = results[levelId];
      if (!result) return null;
      return {
        user_id: userId,
        level_id: levelId,
        best_moves: result.bestMoves,
        stars: result.stars,
        best_time_ms: result.bestTimeMs,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return;

  const { error } = await supabase.from('level_results').upsert(rows, { onConflict: 'user_id,level_id' });
  if (!error) useProgress.getState().clearDirty(dirty);
}

/**
 * Pull remote results and merge them in.
 *
 * The merge always keeps the better of the two - fewest moves wins, and stars and times
 * take their best value independently. That makes sync commutative, so it does not matter
 * which device syncs first.
 */
export async function pullRemote(): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSession();
  if (!userId) return;

  const { data, error } = await supabase
    .from('level_results')
    .select('level_id, best_moves, stars, best_time_ms')
    .eq('user_id', userId);

  if (error || !data) return;

  const progress = useProgress.getState();
  for (const row of data) {
    const local = progress.results[row.level_id];
    if (!local || row.best_moves < local.bestMoves) {
      progress.recordResult(row.level_id, row.stars, row.best_moves, row.best_time_ms);
    }
  }
}
