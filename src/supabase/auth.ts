import { supabase } from './client';

/**
 * Sign the player in anonymously on first launch.
 *
 * There is no signup wall in this game. A player gets cloud save, the daily challenge and
 * a leaderboard entry without ever seeing a form. Upgrading to a real account later is a
 * deliberate future hook, not something the player is nagged about.
 */
let inFlight: Promise<string | null> | null = null;

export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id) return data.session.user.id;

    const { data: created, error } = await supabase.auth.signInAnonymously();
    if (error) return null;
    return created.user?.id ?? null;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
