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
import { ensureSession } from '@/supabase/auth';

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

  useEffect(() => {
    hydrate();
    // Anonymous sign-in happens quietly in the background. It must never block play, so
    // a failure here is deliberately ignored - the game is offline-first.
    ensureSession().catch(() => {});
  }, [hydrate]);

  useEffect(() => {
    setHapticsEnabled(hapticsEnabled);
  }, [hapticsEnabled]);

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
