import type { Dispatch } from '@/types/action';
import type { HandPose, Landmark, RecognizedGesture } from './gestureTypes';

const SWIPE_MIN_DISTANCE = 0.18;
const SWIPE_MAX_DURATION_MS = 600;
const SWIPE_COOLDOWN_MS = 700;
const PINCH_ZOOM_SENSITIVITY = 6;
const PAN_SENSITIVITY = 800;
const POSE_HOLD_TO_TRIGGER_MS = 500;

interface TrackedSwipe {
  startPosition: Landmark;
  startTimeMs: number;
}

/**
 * Converts a stream of per-frame RecognizedGesture readings into semantic
 * Actions. This is the only place that knows about swipe thresholds, pinch
 * sensitivity, etc. — the InputSource just feeds it frames and it dispatches.
 */
export class GestureInterpreter {
  private dispatch: Dispatch | null = null;

  private openPalmSwipeTracker: TrackedSwipe | null = null;
  private lastSwipeAtMs = 0;

  private lastPinchDistance: number | null = null;
  private lastFistPosition: Landmark | null = null;

  private currentPose: HandPose = 'unknown';
  private poseSinceMs = 0;
  private thumbsUpTriggered = false;
  private palmHoldTriggered = false;

  start(dispatch: Dispatch): void {
    this.dispatch = dispatch;
  }

  stop(): void {
    this.dispatch = null;
    this.resetTrackers();
  }

  /** Feed one frame's recognized gesture (or null if no hand is visible). */
  process(gesture: RecognizedGesture | null, timestampMs: number): void {
    if (!this.dispatch) return;

    if (!gesture) {
      this.resetTrackers();
      return;
    }

    if (gesture.pose !== this.currentPose) {
      this.currentPose = gesture.pose;
      this.poseSinceMs = timestampMs;
      this.thumbsUpTriggered = false;
      this.palmHoldTriggered = false;
      if (gesture.pose !== 'fist') this.lastFistPosition = null;
      if (gesture.pose !== 'pinch') this.lastPinchDistance = null;
    }

    switch (gesture.pose) {
      case 'open_palm':
        this.handleOpenPalm(gesture, timestampMs);
        break;
      case 'fist':
        this.handleFist(gesture);
        break;
      case 'pinch':
        this.handlePinch(gesture);
        break;
      case 'thumbs_up':
        this.handleThumbsUp(timestampMs);
        break;
      default:
        this.openPalmSwipeTracker = null;
    }
  }

  private handleOpenPalm(gesture: RecognizedGesture, timestampMs: number): void {
    if (!this.openPalmSwipeTracker) {
      this.openPalmSwipeTracker = { startPosition: gesture.position, startTimeMs: timestampMs };
    }

    const elapsed = timestampMs - this.openPalmSwipeTracker.startTimeMs;
    const dx = gesture.position.x - this.openPalmSwipeTracker.startPosition.x;

    if (elapsed <= SWIPE_MAX_DURATION_MS && Math.abs(dx) >= SWIPE_MIN_DISTANCE) {
      const canSwipe = timestampMs - this.lastSwipeAtMs > SWIPE_COOLDOWN_MS;
      if (canSwipe) {
        this.dispatch?.({ type: dx > 0 ? 'PREVIOUS' : 'NEXT' });
        this.lastSwipeAtMs = timestampMs;
        this.openPalmSwipeTracker = null;
      }
    } else if (elapsed > SWIPE_MAX_DURATION_MS) {
      this.openPalmSwipeTracker = { startPosition: gesture.position, startTimeMs: timestampMs };
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

  private handleFist(gesture: RecognizedGesture): void {
    if (this.lastFistPosition) {
      const dx = (gesture.position.x - this.lastFistPosition.x) * PAN_SENSITIVITY;
      const dy = (gesture.position.y - this.lastFistPosition.y) * PAN_SENSITIVITY;
      this.dispatch?.({ type: 'PAN', dx, dy });
    }
    this.lastFistPosition = gesture.position;
  }

  private handlePinch(gesture: RecognizedGesture): void {
    if (this.lastPinchDistance !== null && gesture.pinchDistance !== undefined) {
      const delta = (gesture.pinchDistance - this.lastPinchDistance) * PINCH_ZOOM_SENSITIVITY;
      if (Math.abs(delta) > 0.001) {
        this.dispatch?.({ type: 'ZOOM', delta });
      }
    }
    this.lastPinchDistance = gesture.pinchDistance ?? null;
  }

  private handleThumbsUp(timestampMs: number): void {
    if (!this.thumbsUpTriggered && timestampMs - this.poseSinceMs > POSE_HOLD_TO_TRIGGER_MS) {
      this.thumbsUpTriggered = true;
      this.dispatch?.({ type: 'TOGGLE_SLIDESHOW' });
    }
  }

  private resetTrackers(): void {
    this.openPalmSwipeTracker = null;
    this.lastPinchDistance = null;
    this.lastFistPosition = null;
    this.currentPose = 'unknown';
  }
}

