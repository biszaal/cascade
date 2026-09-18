import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { reminderDates } from './reminder-schedule';
import { streakTag } from './streak';

/**
 * The daily reminder: one local notification, scheduled on the device.
 *
 * There is no push server and nothing is sent anywhere - the game never learns whether a
 * reminder was opened. Every call is guarded and swallows its errors, for the same reason
 * haptics are: a reminder that fails to schedule must cost the reminder, never the game.
 */

export type ReminderState = 'on' | 'denied' | 'blocked';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';
const CHANNEL = 'daily';
/** How far ahead to schedule. Re-run on every foreground and every solve, so it stays full. */
const WINDOW_DAYS = 7;

/** A reminder that lands mid-board must never cover it. */
export function configure(): void {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Daily challenge',
    // A nudge, not an alarm. MAX would let it interrupt whatever the phone is doing.
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function bodyFor(streak: number): string {
  const base = "Today's board is up.";
  return streak > 0 ? `${base} Keep your ${streakTag(streak)} going.` : base;
}

/**
 * Replace the scheduled window.
 *
 * Cancelling everything first is safe because this is the app's only notification, and it is
 * what makes this idempotent - it can be called on every foreground without piling reminders
 * up. A repeating daily trigger would be simpler but cannot be conditional, so it would fire
 * on a day the player had already solved.
 */
export async function reschedule(
  hour: number,
  minute: number,
  lastSolvedUtcDay: string,
  streak: number,
): Promise<void> {
  if (!supported) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await ensureChannel();
    await Notifications.cancelAllScheduledNotificationsAsync();

    const body = bodyFor(streak);
    for (const date of reminderDates(new Date(), hour, minute, lastSolvedUtcDay, WINDOW_DAYS)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Cascade', body, data: { url: 'cascade://daily' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
      });
    }
  } catch {
    // An unschedulable reminder is not worth a crash on the way into the app.
  }
}

/**
 * Ask, then schedule.
 *
 * Called only from the Settings switch. iOS grants exactly one system prompt for the life of
 * an install, so spending it at launch - before the player has asked for anything - is how
 * the feature ends up permanently denied.
 */
export async function enable(
  hour: number,
  minute: number,
  lastSolvedUtcDay: string,
  streak: number,
): Promise<ReminderState> {
  if (!supported) return 'blocked';
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== 'granted') {
      if (!current.canAskAgain) return 'blocked';
      const asked = await Notifications.requestPermissionsAsync();
      if (asked.status !== 'granted') return asked.canAskAgain ? 'denied' : 'blocked';
    }
    await reschedule(hour, minute, lastSolvedUtcDay, streak);
    return 'on';
  } catch {
    return 'denied';
  }
}

export async function disable(): Promise<void> {
  if (!supported) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing to do: the switch is off either way.
  }
}

/** Whether the OS still allows this, so a permission revoked in Settings turns the switch off. */
export async function isStillPermitted(): Promise<boolean> {
  if (!supported) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Tapping a reminder should land on the board it is about, not on the home screen. */
export function addResponseListener(open: (url: string) => void): () => void {
  if (!supported) return () => {};
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  });
  return () => subscription.remove();
}
