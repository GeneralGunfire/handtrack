import type { Dispatch } from '@/types/action';
import type { HandPose, Landmark } from './gestureTypes';
import type { SmoothedGesture } from './HandLockTracker';

const SWIPE_MIN_DISTANCE = 0.09;
const SWIPE_MAX_DURATION_MS = 900;
const SWIPE_COOLDOWN_MS = 700;
const PAN_SENSITIVITY = 800;
const POSE_HOLD_TO_TRIGGER_MS = 500;
const FIST_STOP_COOLDOWN_MS = 900;

/** Zoom multiplier per unit change in normalized pinch ratio; continuous, not threshold-triggered. */
const ZOOM_SENSITIVITY = 4;

/** Open palm only pans (instead of swiping) once the viewer is zoomed in past this scale. */
const PAN_ZOOM_THRESHOLD = 1.05;

interface TrackedSwipe {
  startPosition: Landmark;
  startTimeMs: number;
}

export interface GestureInterpreterContext {
  /** Current viewer zoom scale, so open-palm movement can decide pan vs. swipe. */
  getZoomScale: () => number;
}

/**
 * Converts a stream of locked, smoothed hand gestures into semantic
 * Actions. Only ever receives frames once HandLockTracker has confirmed a
 * stable lock, so it never has to guess whether a reading is trustworthy —
 * it only has to decide what the reading means.
 *
 * Note on the camera feed: the video is mirrored (selfie view), so a hand
 * moving to the user's right decreases raw landmark x. Swipe direction
 * below is chosen to match what the user sees on screen, not raw x sign.
 */
export class GestureInterpreter {
  private dispatch: Dispatch | null = null;
  private context: GestureInterpreterContext;

  private openPalmTracker: TrackedSwipe | null = null;
  private lastSwipeAtMs = 0;

  private lastNormalizedPinch: number | null = null;
  private lastPanPosition: Landmark | null = null;

  private currentPose: HandPose = 'unknown';
  private poseSinceMs = 0;
  private thumbsUpTriggered = false;
  private palmHoldTriggered = false;
  private lastFistStopAtMs = 0;

  constructor(context: GestureInterpreterContext) {
    this.context = context;
  }

  start(dispatch: Dispatch): void {
    this.dispatch = dispatch;
  }

  stop(): void {
    this.dispatch = null;
    this.reset();
  }

  reset(): void {
    this.openPalmTracker = null;
    this.lastNormalizedPinch = null;
    this.lastPanPosition = null;
    this.currentPose = 'unknown';
    this.thumbsUpTriggered = false;
    this.palmHoldTriggered = false;
  }

  /** Feed one locked, smoothed frame. Call reset() instead when lock is lost. */
  process(gesture: SmoothedGesture, timestampMs: number): void {
    if (!this.dispatch) return;

    if (gesture.pose !== this.currentPose) {
      this.currentPose = gesture.pose;
      this.poseSinceMs = timestampMs;
      this.thumbsUpTriggered = false;
      this.palmHoldTriggered = false;
      if (gesture.pose !== 'open_palm') {
        this.openPalmTracker = null;
        this.lastPanPosition = null;
      }
    }

    // Continuous pinch tracking runs regardless of discrete pose, so it
    // never resets mid-gesture the way threshold-triggered pinch did.
    this.handlePinchZoom(gesture);

    switch (gesture.pose) {
      case 'open_palm':
        this.handleOpenPalm(gesture, timestampMs);
        break;
      case 'fist':
        this.handleFistStop(timestampMs);
        break;
      case 'thumbs_up':
        this.handleThumbsUp(timestampMs);
        break;
      default:
        break;
    }
  }

  private handleOpenPalm(gesture: SmoothedGesture, timestampMs: number): void {
    const isZoomedIn = this.context.getZoomScale() > PAN_ZOOM_THRESHOLD;

    if (isZoomedIn) {
      this.openPalmTracker = null;
      if (this.lastPanPosition) {
        const dx = (gesture.position.x - this.lastPanPosition.x) * -PAN_SENSITIVITY;
        const dy = (gesture.position.y - this.lastPanPosition.y) * PAN_SENSITIVITY;
        this.dispatch?.({ type: 'PAN', dx, dy });
      }
      this.lastPanPosition = gesture.position;
      return;
    }
    this.lastPanPosition = null;

    if (!this.openPalmTracker) {
      this.openPalmTracker = { startPosition: gesture.position, startTimeMs: timestampMs };
    }

    const elapsed = timestampMs - this.openPalmTracker.startTimeMs;
    // Mirrored feed: user moving hand to their own right decreases raw x.
    const dx = gesture.position.x - this.openPalmTracker.startPosition.x;

    if (elapsed <= SWIPE_MAX_DURATION_MS && Math.abs(dx) >= SWIPE_MIN_DISTANCE) {
      const canSwipe = timestampMs - this.lastSwipeAtMs > SWIPE_COOLDOWN_MS;
      if (canSwipe) {
        this.dispatch?.({ type: dx < 0 ? 'NEXT' : 'PREVIOUS' });
        this.lastSwipeAtMs = timestampMs;
        this.openPalmTracker = null;
      }
    } else if (elapsed > SWIPE_MAX_DURATION_MS) {
      this.openPalmTracker = { startPosition: gesture.position, startTimeMs: timestampMs };
    }

    if (
      !this.palmHoldTriggered &&
      timestampMs - this.poseSinceMs > POSE_HOLD_TO_TRIGGER_MS &&
      Math.abs(dx) < SWIPE_MIN_DISTANCE / 2
    ) {
      this.palmHoldTriggered = true;
      this.dispatch?.({ type: 'TOGGLE_UI' });
    }
  }

  /** A held fist is an explicit "stop" gesture: halts slideshow and cancels in-flight swipe/pan tracking. */
  private handleFistStop(timestampMs: number): void {
    this.openPalmTracker = null;
    this.lastPanPosition = null;

    if (timestampMs - this.lastFistStopAtMs > FIST_STOP_COOLDOWN_MS) {
      this.lastFistStopAtMs = timestampMs;
      this.dispatch?.({ type: 'STOP_SLIDESHOW' });
    }
  }

  private handlePinchZoom(gesture: SmoothedGesture): void {
    if (this.lastNormalizedPinch !== null) {
      // Fingers closer together (smaller ratio) = zoom in, so invert the sign.
      const delta = -(gesture.normalizedPinch - this.lastNormalizedPinch) * ZOOM_SENSITIVITY;
      if (Math.abs(delta) > 0.0015) {
        this.dispatch?.({ type: 'ZOOM', delta });
      }
    }
    this.lastNormalizedPinch = gesture.normalizedPinch;
  }

  private handleThumbsUp(timestampMs: number): void {
    if (!this.thumbsUpTriggered && timestampMs - this.poseSinceMs > POSE_HOLD_TO_TRIGGER_MS) {
      this.thumbsUpTriggered = true;
      this.dispatch?.({ type: 'TOGGLE_SLIDESHOW' });
    }
  }
}
