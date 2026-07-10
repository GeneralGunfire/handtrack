import type { Landmark, RecognizedGesture } from './gestureTypes';

const STICKINESS_RADIUS = 0.25;

/**
 * Picks which of up to 2 detected hands should drive the interpreter this
 * frame. Either hand can perform either gesture, so the choice is: prefer
 * whichever hand is closer to whichever hand was driving things last frame
 * (avoids flickering between hands when both are in view), otherwise
 * prefer a hand with a recognized pose (fist/open_palm) over 'unknown'.
 */
export function selectPrimaryGesture(
  gestures: RecognizedGesture[],
  lastPosition: Landmark | null,
): RecognizedGesture | null {
  if (gestures.length === 0) return null;
  if (gestures.length === 1) return gestures[0];

  if (lastPosition) {
    const closest = [...gestures].sort(
      (a, b) => distance(a.position, lastPosition) - distance(b.position, lastPosition),
    )[0];
    if (distance(closest.position, lastPosition) < STICKINESS_RADIUS) {
      return closest;
    }
  }

  const recognized = gestures.find((g) => g.pose !== 'unknown');
  return recognized ?? gestures[0];
}

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
