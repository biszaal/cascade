import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, space, surface, type } from '@/design/tokens';
import { useProgress } from '@/state/progress';
import { BackIcon } from '@/components/Icons';
import { isSupabaseConfigured } from '@/supabase/client';
import { flushPending, pullRemote } from '@/data/sync';
import { metricsFor } from '@/game/responsive';

export default function Settings() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const metrics = metricsFor(width, height);
  const haptics = useProgress((s) => s.hapticsEnabled);
  const sound = useProgress((s) => s.soundEnabled);
  const setHaptics = useProgress((s) => s.setHaptics);
  const setSound = useProgress((s) => s.setSound);
  const reset = useProgress((s) => s.reset);
  const dirty = useProgress((s) => s.dirty);
  const [syncing, setSyncing] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.list, { maxWidth: metrics.contentWidth }]}>
        <Section title="Feel">
          <Row label="Haptics" description="Vibration on lift, place and completion">
            <Switch
              value={haptics}
              onValueChange={setHaptics}
              trackColor={{ true: surface.accent, false: surface.inactive }}
            />
          </Row>
          <Row label="Sound" description="Soft wooden clicks as tokens land">
            <Switch
              value={sound}
              onValueChange={setSound}
              trackColor={{ true: surface.accent, false: surface.inactive }}
            />
          </Row>
        </Section>

        {/* Sync only exists when a backend is configured. An offline build leaves the section out
            rather than showing a control that can never do anything. */}
        {isSupabaseConfigured ? (
          <Section title="Cloud">
            <Row
              label="Sync"
              description={
                dirty.length > 0
                  ? `${dirty.length} result${dirty.length === 1 ? '' : 's'} waiting to upload`
                  : 'Everything is up to date'
              }
            >
              <Pressable
                disabled={syncing}
                onPress={async () => {
                  setSyncing(true);
                  await flushPending().catch(() => {});
                  await pullRemote().catch(() => {});
                  setSyncing(false);
                }}
                style={[styles.smallButton, syncing && styles.smallButtonOff]}
              >
                <Text style={styles.smallButtonLabel}>{syncing ? 'Syncing' : 'Sync now'}</Text>
              </Pressable>
            </Row>
          </Section>
        ) : null}

        <Section title="Progress">
          <Row label="Reset everything" description="Clears every star and best score on this device">
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Reset progress?',
                  'Every star and best score on this device will be erased. This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset', style: 'destructive', onPress: () => void reset() },
                  ],
                )
              }
              style={[styles.smallButton, styles.smallButtonDanger]}
            >
              <Text style={[styles.smallButtonLabel, styles.smallButtonLabelDanger]}>Reset</Text>
            </Pressable>
          </Row>
        </Section>

        <Text style={styles.about}>
          Every level was solved by a search before it shipped. Par is that solution's length, plus
          a small allowance on boards with face-down tokens. Three stars means you matched it.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.board },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.base, paddingVertical: space.md },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: surface.ink },

  list: { padding: space.base, gap: space.lg, paddingBottom: space.xxl, width: '100%', alignSelf: 'center' },
  section: { gap: space.sm },
  sectionTitle: { ...type.label, fontSize: 10, letterSpacing: 1.4, color: surface.graphite, marginLeft: space.xs },
  card: {
    backgroundColor: surface.chalk,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: surface.hairline,
    paddingHorizontal: space.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.base,
    paddingVertical: space.base,
    minHeight: 64,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...type.body, color: surface.ink },
  rowDescription: { ...type.label, color: surface.graphite },

  smallButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.base,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: surface.hairline,
  },
  smallButtonOff: { opacity: 0.4 },
  smallButtonDanger: { borderColor: 'rgba(232,112,58,0.45)' },
  smallButtonLabel: { ...type.label, color: surface.ink },
  smallButtonLabelDanger: { color: surface.danger },

  about: { ...type.label, color: surface.graphite, lineHeight: 19, marginTop: space.sm, paddingHorizontal: space.xs },
});
