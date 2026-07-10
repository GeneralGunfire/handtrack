import type { Dispatch } from '@/types/action';
import type { GestureMode, HandPose, Landmark } from './gestureTypes';
import type { SmoothedGesture } from './HandLockTracker';

const SWIPE_MIN_DISTANCE = 0.09;
const SWIPE_MAX_DURATION_MS = 900;
const SWIPE_COOLDOWN_MS = 700;
const PAN_SENSITIVITY = 800;

/** Zoom multiplier per unit change in normalized pinch ratio; continuous, mobile-style pinch-to-zoom. */
const ZOOM_SENSITIVITY = 4;

/** Open palm must be held this long before it toggles pan+zoom mode, so passing through
 *  the pose on the way to another one doesn't accidentally trigger it. */
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
 * Actions:
 *
 *   - Fist + move left/right: swipe to previous/next image. Works from
 *     neutral at any time — no mode toggle needed.
 *   - Open palm (held): toggles combined pan+zoom mode. While active,
 *     hand position pans and thumb-index pinch distance zooms, both at
 *     once, like pinch-to-zoom-and-drag on a touchscreen. Open palm
 *     again (held) exits back to neutral.
 *
 * Only ever receives frames once HandLockTracker has confirmed a stable
 * lock, so it never has to guess whether a reading is trustworthy.
 */
export class GestureInterpreter {
  private dispatch: Dispatch | null = null;
  private onModeChange?: (change: GestureModeChange) => void;

  private mode: GestureMode = 'neutral';

  private fistSwipeTracker: TrackedSwipe | null = null;
  private lastSwipeAtMs = 0;

  private lastPanPosition: Landmark | null = null;
  private lastNormalizedPinch: number | null = null;

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
    this.fistSwipeTracker = null;
    this.lastPanPosition = null;
    this.lastNormalizedPinch = null;
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
      if (gesture.pose !== 'fist') this.fistSwipeTracker = null;
    }

    const heldMs = timestampMs - this.poseSinceMs;
    const canToggle =
      this.modeToggleArmed && timestampMs - this.lastModeToggleAtMs > MODE_TOGGLE_COOLDOWN_MS;

    if (
      gesture.pose === 'open_palm' &&
      canToggle &&
      heldMs >= MODE_TOGGLE_HOLD_MS
    ) {
      this.enterMode(this.mode === 'pan_zoom' ? 'neutral' : 'pan_zoom', timestampMs);
      return;
    }

    if (this.mode === 'pan_zoom' && gesture.pose === 'open_palm') {
      this.handlePanZoom(gesture);
      return;
    }

    if (this.mode === 'neutral' && gesture.pose === 'fist') {
      this.handleSwipe(gesture, timestampMs);
    }
  }

  private enterMode(mode: GestureMode, timestampMs: number): void {
    this.mode = mode;
    this.modeToggleArmed = false;
    this.lastModeToggleAtMs = timestampMs;
    this.lastPanPosition = null;
    this.lastNormalizedPinch = null;
    this.onModeChange?.({ mode });
  }

  private handleSwipe(gesture: SmoothedGesture, timestampMs: number): void {
    if (!this.fistSwipeTracker) {
      this.fistSwipeTracker = { startPosition: gesture.position, startTimeMs: timestampMs };
      return;
    }

    const elapsed = timestampMs - this.fistSwipeTracker.startTimeMs;
    // Camera feed is unmirrored; a hand moving to the user's own right
    // decreases raw landmark x, so a negative dx means "moved right".
    const dx = gesture.position.x - this.fistSwipeTracker.startPosition.x;

    if (elapsed <= SWIPE_MAX_DURATION_MS && Math.abs(dx) >= SWIPE_MIN_DISTANCE) {
      const canSwipe = timestampMs - this.lastSwipeAtMs > SWIPE_COOLDOWN_MS;
      if (canSwipe) {
        this.dispatch?.({ type: dx < 0 ? 'NEXT' : 'PREVIOUS' });
        this.lastSwipeAtMs = timestampMs;
        this.fistSwipeTracker = null;
      }
    } else if (elapsed > SWIPE_MAX_DURATION_MS) {
      this.fistSwipeTracker = { startPosition: gesture.position, startTimeMs: timestampMs };
    }
  }

  /** Pan from hand position and zoom from pinch distance, applied together every frame. */
  private handlePanZoom(gesture: SmoothedGesture): void {
    if (this.lastPanPosition) {
      const dx = (gesture.position.x - this.lastPanPosition.x) * -PAN_SENSITIVITY;
      const dy = (gesture.position.y - this.lastPanPosition.y) * PAN_SENSITIVITY;
      if (dx !== 0 || dy !== 0) {
        this.dispatch?.({ type: 'PAN', dx, dy });
      }
    }
    this.lastPanPosition = gesture.position;

    if (this.lastNormalizedPinch !== null) {
      // Fingers closer together (smaller ratio) = zoom in, so invert the sign.
      const delta = -(gesture.normalizedPinch - this.lastNormalizedPinch) * ZOOM_SENSITIVITY;
      if (Math.abs(delta) > 0.0015) {
        this.dispatch?.({ type: 'ZOOM', delta });
      }
    }
    this.lastNormalizedPinch = gesture.normalizedPinch;
  }
}
