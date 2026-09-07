import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Supabase is optional. The game is fully playable with no network and no credentials
 * configured - sync, the daily challenge and the leaderboard simply stay unavailable.
 * Nothing in the play loop may ever await this client.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // No deep-link auth callbacks in this app; anonymous sign-in needs no URL parsing.
        detectSessionInUrl: false,
      },
    })
  : null;
