import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { play } from './sound';

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

/**
 * Feedback for one game event: haptic and sound together.
 *
 * They are deliberately emitted from a single call so the two can never drift apart -
 * a board that buzzes without clicking, or clicks without buzzing, feels broken.
 */

/** A token leaves its lane. */
export const tapLift = () => {
  safely(() => Haptics.selectionAsync());
  play('lift');
};

/** A token lands. */
export const tapPlace = () => {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  play('place');
};

/** A lane fills with a single colour. */
export const tapComplete = () => {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  play('complete');
};

/** The move was refused. */
export const tapInvalid = () => {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  play('invalid');
};

/** The board is solved. */
export const tapWin = () => {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  play('win');
};
