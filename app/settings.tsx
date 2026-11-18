import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { plane, radius, space, surface, type } from '@/design/tokens';
import { useProgress } from '@/state/progress';
import { BackIcon } from '@/components/Icons';
import { Slider } from '@/components/Slider';
import { isSupabaseConfigured } from '@/supabase/client';
import { deleteAccount } from '@/supabase/auth';
import { flushPending, pullRemote } from '@/data/sync';
import { metricsFor } from '@/game/responsive';
import * as reminders from '@/game/reminders';
import { streakOn } from '@/game/streak';
// Applied straight to the players while a finger is moving, so the level can be heard as
// it is chosen; the store is only written when the finger lifts.
import { play as playSound, setSoundVolume as applySoundVolume } from '@/game/sound';
import { setMusicVolume as applyMusicVolume } from '@/game/music';
import { utcDay } from '@/game/day';

/**
 * The times the reminder can be set to.
 *
 * A fixed handful rather than a picker: @react-native-community/datetimepicker is a native
 * dependency, and this is a setting almost nobody will change twice.
 */
const REMINDER_HOURS = [8, 12, 18, 20];

/**
 * Android tints a switch's thumb with the system accent - a teal that clashes with the orange
 * track - unless told otherwise. iOS already draws it white, so it is left alone there.
 */
const switchColors = {
  trackColor: { true: surface.accent, false: surface.inactive },
  thumbColor: Platform.OS === 'android' ? surface.ink : undefined,
};

const clock = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

export default function Settings() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const metrics = metricsFor(width, height);
  const haptics = useProgress((s) => s.hapticsEnabled);
  const sound = useProgress((s) => s.soundEnabled);
  const music = useProgress((s) => s.musicEnabled);
  const setHaptics = useProgress((s) => s.setHaptics);
  const setSound = useProgress((s) => s.setSound);
  const setMusic = useProgress((s) => s.setMusic);
  const soundVolume = useProgress((s) => s.soundVolume);
  const musicVolume = useProgress((s) => s.musicVolume);
  const setSoundVolume = useProgress((s) => s.setSoundVolume);
  const setMusicVolume = useProgress((s) => s.setMusicVolume);

  // A drag is previewed locally so the percentage keeps up with the finger without writing
  // to storage on every frame.
  const [soundDraft, setSoundDraft] = useState(soundVolume);
  const [musicDraft, setMusicDraft] = useState(musicVolume);
  useEffect(() => setSoundDraft(soundVolume), [soundVolume]);
  useEffect(() => setMusicDraft(musicVolume), [musicVolume]);
  const reset = useProgress((s) => s.reset);
  const dirty = useProgress((s) => s.dirty);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remindersEnabled = useProgress((s) => s.remindersEnabled);
  const reminderHour = useProgress((s) => s.reminderHour);
  const reminderMinute = useProgress((s) => s.reminderMinute);
  const setReminder = useProgress((s) => s.setReminder);
  const dailyLastDay = useProgress((s) => s.dailyLastDay);
  const dailyStreak = useProgress((s) => s.dailyStreak);
  const dailyBest = useProgress((s) => s.dailyBest);
  // Set when the OS says it will not ask again, which is the one case a switch cannot fix.
  const [reminderBlocked, setReminderBlocked] = useState(false);

  const liveStreak = () =>
    streakOn({ current: dailyStreak, best: dailyBest, lastDay: dailyLastDay }, utcDay());

  async function toggleReminder(value: boolean) {
    if (!value) {
      setReminder(false);
      setReminderBlocked(false);
      await reminders.disable();
      return;
    }
    // The permission is requested here and nowhere else. iOS grants exactly one prompt for the
    // life of an install, so asking at launch - before the player has asked for anything - is
    // how the feature ends up denied forever.
    const state = await reminders.enable(reminderHour, reminderMinute, dailyLastDay, liveStreak());
    setReminderBlocked(state === 'blocked');
    // Stored only once the OS has actually granted it, so the switch can never read on while
    // the phone stays silent.
    setReminder(state === 'on');
  }

  async function cycleReminderTime() {
    const i = REMINDER_HOURS.indexOf(reminderHour);
    const next = REMINDER_HOURS[(i + 1) % REMINDER_HOURS.length]!;
    setReminder(true, next, 0);
    await reminders.reschedule(next, 0, dailyLastDay, liveStreak());
  }

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
              {...switchColors}
            />
          </Row>
          <Row label="Sound" description="Playful pops and boops as tokens move">
            <Switch
              value={sound}
              onValueChange={setSound}
              {...switchColors}
            />
          </Row>
          <SliderRow
            label="Volume"
            accessibilityLabel="Sound volume"
            value={soundDraft}
            disabled={!sound}
            onChange={(next) => {
              setSoundDraft(next);
              applySoundVolume(next);
            }}
            onCommit={(next) => {
              setSoundVolume(next);
              // A volume you cannot hear is not a setting. The tap is the sample.
              if (sound) playSound('tap');
            }}
          />
          <Row label="Music" description="A calm tune in the background">
            <Switch
              value={music}
              onValueChange={setMusic}
              {...switchColors}
            />
          </Row>
          <SliderRow
            label="Volume"
            accessibilityLabel="Music volume"
            value={musicDraft}
            disabled={!music}
            onChange={(next) => {
              setMusicDraft(next);
              applyMusicVolume(next);
            }}
            onCommit={setMusicVolume}
          />
        </Section>

        {/* Its own section rather than another switch under Feel: Feel is about what the game
            does while you are playing, and this is about what it does when it is closed. */}
        <Section title="Daily">
          <Row
            label="Reminder"
            description={
              reminderBlocked
                ? 'Notifications are turned off for Cascade in your phone settings'
                : 'A nudge when a new daily board is up'
            }
          >
            {reminderBlocked ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Settings"
                onPress={() => Linking.openSettings().catch(() => {})}
                style={styles.smallButton}
              >
                <Text style={styles.smallButtonLabel}>Open Settings</Text>
              </Pressable>
            ) : (
              <Switch
                value={remindersEnabled}
                onValueChange={toggleReminder}
                {...switchColors}
              />
            )}
          </Row>

          {remindersEnabled ? (
            <Row label="Time" description="When the reminder arrives">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reminder time, ${clock(reminderHour, reminderMinute)}`}
                onPress={cycleReminderTime}
                style={styles.smallButton}
              >
                <Text style={styles.smallButtonLabel}>{clock(reminderHour, reminderMinute)}</Text>
              </Pressable>
            </Row>
          ) : null}
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

        {/* With a backend, the player has an anonymous account, so resetting must delete it too
            (App Store guideline 5.1.1(v)). The server goes first: if it cannot be reached, the
            device keeps its progress rather than being wiped while the online copy survives. */}
        {isSupabaseConfigured ? (
          <Section title="Your data">
            <Row
              label="Delete my data"
              description="Erases progress on this device, and your online account and leaderboard results"
            >
              <Pressable
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Delete my data"
                onPress={() =>
                  Alert.alert(
                    'Delete your data?',
                    'Your stars and best scores on this device, your anonymous online account and your leaderboard results will be deleted. This cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          setDeleting(true);
                          const deleted = await deleteAccount().catch(() => false);
                          if (deleted) await reset();
                          setDeleting(false);
                          Alert.alert(
                            deleted ? 'Data deleted' : "Couldn't delete your data",
                            deleted
                              ? 'Your progress and online account have been deleted.'
                              : 'Check your internet connection and try again. Nothing was deleted.',
                          );
                        },
                      },
                    ],
                  )
                }
                style={[styles.smallButton, styles.smallButtonDanger, deleting && styles.smallButtonOff]}
              >
                <Text style={[styles.smallButtonLabel, styles.smallButtonLabelDanger]}>
                  {deleting ? 'Deleting' : 'Delete'}
                </Text>
              </Pressable>
            </Row>
          </Section>
        ) : (
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
        )}

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

/**
 * A full-width control under the switch it belongs to. `Row` puts its control to the right
 * of the label, which leaves a slider about a thumb wide.
 */
function SliderRow({
  label,
  accessibilityLabel,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  accessibilityLabel: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHead}>
        <Text style={[styles.rowLabel, disabled && styles.sliderLabelOff]}>{label}</Text>
        <Text style={styles.sliderValue}>{Math.round(value * 100)}%</Text>
      </View>
      <Slider
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        label={accessibilityLabel}
        disabled={disabled}
      />
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
  sectionTitle: { ...type.micro, color: surface.graphite, marginLeft: space.xs },
  card: {
    ...plane('raised'),
    borderRadius: radius.lg,
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
  sliderRow: { paddingBottom: space.md, gap: space.xs, marginTop: -space.sm },
  sliderHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sliderLabelOff: { color: surface.graphite },
  sliderValue: { ...type.micro, color: surface.graphite },
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
