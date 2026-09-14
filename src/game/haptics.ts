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

/**
 * The board has dead-ended. Fired as the out-of-moves sheet appears rather than when the
 * last token lands, so the player hears it at the moment they are told.
 */
export const tapStuck = () => {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  play('stuck');
};

/** A move is taken back. */
export const tapUndo = () => {
  safely(() => Haptics.selectionAsync());
  play('undo');
};

/** The level starts over. */
export const tapRestart = () => {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  play('restart');
};

/** A star stamps onto the win sheet. */
export const tapStar = () => {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  play('star');
};

/** A hint lights up a move. */
export const tapHint = () => {
  safely(() => Haptics.selectionAsync());
  play('hint');
};

/**
 * Any button. Sound only: a buzz on every menu press would dull the haptics that mean
 * something on the board.
 */
export const tapButton = () => {
  play('tap');
};
