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

/**
 * Delete the player's account and everything stored with it on the server.
 *
 * Returns false when the server could not be reached, so the caller can keep local progress
 * rather than wipe the device while the online copy survives. The local session is dropped
 * afterwards, and the next sync signs in as a brand-new anonymous player.
 */
export async function deleteAccount(): Promise<boolean> {
  if (!supabase) return true;
  // Never signed in means nothing was ever stored on the server.
  if (!(await currentUserId())) return true;

  const { error } = await supabase.rpc('delete_my_account');
  if (error) return false;

  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  return true;
}

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
