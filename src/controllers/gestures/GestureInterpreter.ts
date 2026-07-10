import type { Dispatch } from '@/types/action';
import type { GestureMode, HandPose, Landmark } from './gestureTypes';
import type { SmoothedGesture } from './HandLockTracker';

const SWIPE_MIN_DISTANCE = 0.09;
const SWIPE_MAX_DURATION_MS = 900;
const SWIPE_COOLDOWN_MS = 700;
const PAN_SENSITIVITY = 800;

/** Zoom multiplier per unit change in normalized hand-span (depth proxy). */
const ZOOM_SENSITIVITY = 5;

/** A mode-toggle gesture must be held this long before it fires, so passing through
 *  a pose on the way to another one doesn't accidentally trigger a mode switch. */
const MODE_TOGGLE_HOLD_MS = 350;
const MODE_TOGGLE_COOLDOWN_MS = 500;

interface TrackedSwipe {
  startPosition: Landmark;
  startTimeMs: number;
}

export interface GestureModeChange {
  mode: GestureMode;
}

export interface GestureInterpreterOptions {
  onModeChange?: (change: GestureModeChange) => void;
}

/**
 * Converts a stream of locked, smoothed hand gestures into semantic
 * Actions using an explicit mode state machine:
 *
 *   neutral --[fist held]--> zoom   --[fist held]--> neutral
 *   neutral --[palm held]--> pan    --[palm held]--> neutral
 *
 * Only one mode is active at a time. In neutral, a two-finger point
 * moving left/right swipes to the next/previous image. Only ever
 * receives frames once HandLockTracker has confirmed a stable lock.
 */
export class GestureInterpreter {
  private dispatch: Dispatch | null = null;
  private onModeChange?: (change: GestureModeChange) => void;

  private mode: GestureMode = 'neutral';

  private pointSwipeTracker: TrackedSwipe | null = null;
  private lastSwipeAtMs = 0;

  private lastPanPosition: Landmark | null = null;
  private lastHandSpan: number | null = null;

  private currentPose: HandPose = 'unknown';
  private poseSinceMs = 0;
  private modeToggleArmed = true;
  private lastModeToggleAtMs = 0;

  constructor(options: GestureInterpreterOptions = {}) {
    this.onModeChange = options.onModeChange;
  }

  start(dispatch: Dispatch): void {
    this.dispatch = dispatch;
  }

  stop(): void {
    this.dispatch = null;
    this.reset();
  }

  reset(): void {
    this.mode = 'neutral';
    this.pointSwipeTracker = null;
    this.lastPanPosition = null;
    this.lastHandSpan = null;
    this.currentPose = 'unknown';
    this.modeToggleArmed = true;
    this.onModeChange?.({ mode: 'neutral' });
  }

  /** Feed one locked, smoothed frame. Call reset() instead when lock is lost. */
  process(gesture: SmoothedGesture, timestampMs: number): void {
    if (!this.dispatch) return;

    const poseChanged = gesture.pose !== this.currentPose;
    if (poseChanged) {
      this.currentPose = gesture.pose;
      this.poseSinceMs = timestampMs;
      this.modeToggleArmed = true;
      if (gesture.pose !== 'two_finger_point') this.pointSwipeTracker = null;
      if (gesture.pose !== 'open_palm') this.lastPanPosition = null;
      if (gesture.pose !== 'fist') this.lastHandSpan = null;
    }

    const heldMs = timestampMs - this.poseSinceMs;
    const canToggle =
      this.modeToggleArmed && timestampMs - this.lastModeToggleAtMs > MODE_TOGGLE_COOLDOWN_MS;

    if (this.mode === 'neutral') {
      if (gesture.pose === 'fist' && canToggle && heldMs >= MODE_TOGGLE_HOLD_MS) {
        this.enterMode('zoom', timestampMs);
      } else if (gesture.pose === 'open_palm' && canToggle && heldMs >= MODE_TOGGLE_HOLD_MS) {
        this.enterMode('pan', timestampMs);
      } else if (gesture.pose === 'two_finger_point') {
        this.handleSwipe(gesture, timestampMs);
      }
      return;
    }

    if (this.mode === 'zoom') {
      if (gesture.pose === 'fist' && canToggle && heldMs >= MODE_TOGGLE_HOLD_MS) {
        this.enterMode('neutral', timestampMs);
        return;
      }
      this.handleZoomDepth(gesture);
      return;
    }

    if (this.mode === 'pan') {
      if (gesture.pose === 'open_palm' && canToggle && heldMs >= MODE_TOGGLE_HOLD_MS) {
        this.enterMode('neutral', timestampMs);
        return;
      }
      this.handlePan(gesture);
      return;
    }
  }

  private enterMode(mode: GestureMode, timestampMs: number): void {
    this.mode = mode;
    this.modeToggleArmed = false;
    this.lastModeToggleAtMs = timestampMs;
    this.lastPanPosition = null;
    this.lastHandSpan = null;
    this.onModeChange?.({ mode });
  }

  private handleSwipe(gesture: SmoothedGesture, timestampMs: number): void {
    if (!this.pointSwipeTracker) {
      this.pointSwipeTracker = { startPosition: gesture.position, startTimeMs: timestampMs };
      return;
    }

    const elapsed = timestampMs - this.pointSwipeTracker.startTimeMs;
    // Camera feed is unmirrored; a hand moving to the user's own right
    // decreases raw landmark x, so a negative dx means "moved right".
    const dx = gesture.position.x - this.pointSwipeTracker.startPosition.x;

    if (elapsed <= SWIPE_MAX_DURATION_MS && Math.abs(dx) >= SWIPE_MIN_DISTANCE) {
      const canSwipe = timestampMs - this.lastSwipeAtMs > SWIPE_COOLDOWN_MS;
      if (canSwipe) {
        this.dispatch?.({ type: dx < 0 ? 'NEXT' : 'PREVIOUS' });
        this.lastSwipeAtMs = timestampMs;
        this.pointSwipeTracker = null;
      }
    } else if (elapsed > SWIPE_MAX_DURATION_MS) {
      this.pointSwipeTracker = { startPosition: gesture.position, startTimeMs: timestampMs };
    }
  }

  private handlePan(gesture: SmoothedGesture): void {
    if (this.lastPanPosition) {
      const dx = (gesture.position.x - this.lastPanPosition.x) * -PAN_SENSITIVITY;
      const dy = (gesture.position.y - this.lastPanPosition.y) * PAN_SENSITIVITY;
      this.dispatch?.({ type: 'PAN', dx, dy });
    }
    this.lastPanPosition = gesture.position;
  }

  private handleZoomDepth(gesture: SmoothedGesture): void {
    if (this.lastHandSpan !== null && this.lastHandSpan > 0) {
      // Larger hand span = closer to camera = zoom in.
      const delta = (gesture.handSpan / this.lastHandSpan - 1) * ZOOM_SENSITIVITY;
      if (Math.abs(delta) > 0.0015) {
        this.dispatch?.({ type: 'ZOOM', delta });
      }
    }
    this.lastHandSpan = gesture.handSpan;
  }
}
