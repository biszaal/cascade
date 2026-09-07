import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { surface } from '@/design/tokens';
import { useProgress } from '@/state/progress';
import { setHapticsEnabled } from '@/game/haptics';
import { setSoundEnabled, release as releaseSound } from '@/game/sound';
import { ensureSession } from '@/supabase/auth';
import { flushPending, pullRemote } from '@/data/sync';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  const hydrate = useProgress((s) => s.hydrate);
  const loaded = useProgress((s) => s.loaded);
  const hapticsEnabled = useProgress((s) => s.hapticsEnabled);
  const soundEnabled = useProgress((s) => s.soundEnabled);

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
  }, [soundEnabled]);

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
