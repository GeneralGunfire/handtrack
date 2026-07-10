import type { Landmark, RecognizedGesture } from './gestureTypes';

const STICKINESS_RADIUS = 0.25;

export interface HandSelection {
  primary: RecognizedGesture | null;
  /** The other hand, if a second one is visible — used for the stop gesture. */
  secondary: RecognizedGesture | null;
}

/**
 * Picks which of up to 2 detected hands drives swipe/pan/zoom this frame,
 * and which (if any) is the "other" hand available for the stop gesture.
 * The primary hand is whichever is closest to wherever it was last frame
 * (avoids flickering between hands when both are in view); with no prior
 * position, the first detected hand is primary.
 */
export function selectHands(
  gestures: RecognizedGesture[],
  lastPrimaryPosition: Landmark | null,
): HandSelection {
  if (gestures.length === 0) return { primary: null, secondary: null };
  if (gestures.length === 1) return { primary: gestures[0], secondary: null };

  if (lastPrimaryPosition) {
    const sorted = [...gestures].sort(
      (a, b) =>
        distance(a.position, lastPrimaryPosition) - distance(b.position, lastPrimaryPosition),
    );
    if (distance(sorted[0].position, lastPrimaryPosition) < STICKINESS_RADIUS) {
      return { primary: sorted[0], secondary: sorted[1] };
    }
  }

  return { primary: gestures[0], secondary: gestures[1] };
}

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
