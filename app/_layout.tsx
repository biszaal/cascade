import { useEffect } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { Stack, type ErrorBoundaryProps, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import { surface } from '@/design/tokens';
import { useProgress } from '@/state/progress';
import { setHapticsEnabled } from '@/game/haptics';
import { msUntilNextDay, utcDay } from '@/game/day';
import * as reminders from '@/game/reminders';
import { streakOn } from '@/game/streak';
import { preloadSounds, setSoundEnabled, release as releaseSound } from '@/game/sound';
import { pauseMusic, resumeMusic, setMusicEnabled } from '@/game/music';
import { ensureSession } from '@/supabase/auth';
import { flushPending, pullRemote } from '@/data/sync';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * The last line of defence for a render error anywhere in the app.
 *
 * Without it, a crash in a release build closes the app with nothing on screen. It uses the
 * system font on purpose: it may render before the custom fonts have loaded, and a missing
 * font must not break the one screen whose job is to survive breakage. Progress is written
 * to device storage as each level is solved, so retrying loses nothing.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  useEffect(() => {
    // An error before first paint would otherwise leave the splash screen covering this.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: surface.board,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
      }}
    >
      <Text style={{ color: surface.ink, fontSize: 22, fontWeight: '600', textAlign: 'center' }}>
        Something went wrong
      </Text>
      <Text style={{ color: surface.graphite, fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
        Your progress is saved on this device.
      </Text>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        style={{
          marginTop: 12,
          paddingVertical: 14,
          paddingHorizontal: 28,
          borderRadius: 999,
          backgroundColor: surface.accent,
        }}
      >
        <Text style={{ color: surface.board, fontSize: 16, fontWeight: '600' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

// A reminder that lands while someone is mid-board must not cover it.
reminders.configure();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  const hydrate = useProgress((s) => s.hydrate);
  const loaded = useProgress((s) => s.loaded);
  const hapticsEnabled = useProgress((s) => s.hapticsEnabled);
  const soundEnabled = useProgress((s) => s.soundEnabled);
  const musicEnabled = useProgress((s) => s.musicEnabled);

  useEffect(() => {
    // Sign in anonymously, then reconcile with the cloud - all in the background. None of
    // this may block play, so every step swallows its own failure: the game is
    // offline-first and a player on a train should never notice this ran at all.
    void (async () => {
      await hydrate();
      const userId = await ensureSession().catch(() => null);
      if (!userId) return;
      // Upload anything finished while offline, then pull results from other devices.
      // Without this, offline progress sat on the device until someone found the manual
      // sync button in Settings.
      await flushPending().catch(() => {});
      await pullRemote().catch(() => {});
    })();
  }, [hydrate]);

  useEffect(() => {
    setHapticsEnabled(hapticsEnabled);
  }, [hapticsEnabled]);

  useEffect(() => {
    setSoundEnabled(soundEnabled);
    // Hand the native players back when the player turns sound off, rather than holding
    // an audio session open for something they have said they do not want.
    if (!soundEnabled) releaseSound();
    // Otherwise load them as soon as the saved preference is known, so the first pour is
    // heard on time.
    else if (loaded) preloadSounds();
  }, [soundEnabled, loaded]);

  useEffect(() => {
    // Wait for the saved preference: starting on the default would play a bar of music at
    // someone who switched it off last time.
    if (!loaded) return;
    setMusicEnabled(musicEnabled);
  }, [loaded, musicEnabled]);

  useEffect(() => {
    // Background playback is off, so pause explicitly rather than letting the OS cut the tune
    // mid-note, and pick it back up when the player returns.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        resumeMusic();
        // iOS can keep the app alive in the background for days, so launch alone would
        // leave yesterday's empty hint count showing after midnight.
        useProgress.getState().refreshHints();
        void refreshReminders();
      } else pauseMusic();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Refill on the stroke of midnight for someone still playing, so a Hint button greyed
    // out at 23:59 lights up without leaving the level. Timers stop in the background,
    // which is what the foreground check above is for.
    if (!loaded) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        useProgress.getState().refreshHints();
        schedule();
      }, msUntilNextDay());
    };
    schedule();
    return () => clearTimeout(timer);
  }, [loaded]);

  useEffect(() => {
    // Tapping a reminder should land on the board it is about.
    return reminders.addResponseListener((url) => {
      if (url.endsWith('/daily')) router.push('/daily');
    });
  }, []);

  useEffect(() => {
    // Top the rolling window back up on launch, and notice a permission revoked in the OS
    // while the app was away - otherwise the switch keeps claiming to be on.
    if (!loaded) return;
    void refreshReminders();
  }, [loaded]);

  useEffect(() => {
    if (fontsLoaded && loaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, loaded]);

  if (!fontsLoaded || !loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: surface.board }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: surface.board },
          animation: 'fade',
        }}
      />
    </GestureHandlerRootView>
  );
}

/**
 * Re-fill the reminder window, and drop the switch if the OS has stopped allowing it.
 *
 * Reads the store directly rather than through hooks, because it is called from an AppState
 * listener that must not re-subscribe every time progress changes.
 */
async function refreshReminders(): Promise<void> {
  const state = useProgress.getState();
  if (!state.remindersEnabled) return;
  if (!(await reminders.isStillPermitted())) {
    state.setReminder(false);
    return;
  }
  const streak = streakOn(
    { current: state.dailyStreak, best: state.dailyBest, lastDay: state.dailyLastDay },
    utcDay(),
  );
  await reminders.reschedule(state.reminderHour, state.reminderMinute, state.dailyLastDay, streak);
}
