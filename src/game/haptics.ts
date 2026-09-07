import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Haptics are a core part of how the board feels, but they are unavailable on web and
 * can throw on a device with the taptic engine disabled - so every call is guarded.
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';
let userEnabled = true;

export function setHapticsEnabled(value: boolean): void {
  userEnabled = value;
}

function safely(run: () => Promise<unknown>): void {
  if (!enabled || !userEnabled) return;
  run().catch(() => {});
}

/** A token leaves its lane. */
export const tapLift = () => safely(() => Haptics.selectionAsync());

/** A token lands. */
export const tapPlace = () =>
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** A lane fills with a single colour. */
export const tapComplete = () =>
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** The move was refused. */
export const tapInvalid = () =>
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

/** The board is solved. */
export const tapWin = () =>
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
