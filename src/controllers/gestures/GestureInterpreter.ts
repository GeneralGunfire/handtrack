import type { Dispatch } from '@/types/action';
import type { GestureMode, Landmark } from './gestureTypes';
import type { SmoothedGesture } from './HandLockTracker';

/** A lateral move at least this fast (normalized units/second) counts as a swipe flick. */
const SWIPE_MIN_SPEED = 0.5;
/** Minimum lateral distance covered, so a tiny jitter at high instantaneous speed doesn't swipe. */
const SWIPE_MIN_DISTANCE = 0.06;
const SWIPE_COOLDOWN_MS = 700;

/** Hand must stay within this radius of its position when stillness started to count as "held still". */
const STILLNESS_RADIUS = 0.035;
const STILLNESS_HOLD_MS = 350;
const MODE_TOGGLE_COOLDOWN_MS = 500;

const PAN_SENSITIVITY = 800;
/** Zoom multiplier per unit change in normalized pinch ratio; continuous, mobile-style pinch-to-zoom. */
const ZOOM_SENSITIVITY = 4;

export interface GestureModeChange {
  mode: GestureMode;
}

export interface GestureInterpreterOptions {
  onModeChange?: (change: GestureModeChange) => void;
}

/**
 * Converts a stream of locked, smoothed hand gestures into semantic
 * Actions using motion, not hand shape, as the primary signal — pose
 * classification (fist/open palm) proved too unreliable across lighting,
 * angle, and camera quality to gate the two most important actions:
 *
 *   - A fast lateral flick swipes to the previous/next image immediately,
 *     regardless of hand shape.
 *   - Holding the hand still for ~350ms toggles combined pan+zoom mode.
 *     While active, hand position pans and thumb-index pinch distance
 *     zooms, both at once. Holding still again exits back to neutral.
 *
 * Speed and stillness are mutually exclusive by construction, so the two
 * triggers can't both fire from the same motion.
 */
export class GestureInterpreter {
  private dispatch: Dispatch | null = null;
  private onModeChange?: (change: GestureModeChange) => void;

  private mode: GestureMode = 'neutral';

  private lastFramePosition: Landmark | null = null;
  private lastFrameTimeMs = 0;
  private lastSwipeAtMs = 0;

  private stillnessAnchor: Landmark | null = null;
  private stillnessSinceMs = 0;
  private lastModeToggleAtMs = 0;

  private lastPanPosition: Landmark | null = null;
  private lastNormalizedPinch: number | null = null;

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
    this.lastFramePosition = null;
    this.stillnessAnchor = null;
    this.lastPanPosition = null;
    this.lastNormalizedPinch = null;
    this.onModeChange?.({ mode: 'neutral' });
  }

  /** Feed one locked, smoothed frame. Call reset() instead when lock is lost. */
  process(gesture: SmoothedGesture, timestampMs: number): void {
    if (!this.dispatch) return;

    if (this.mode === 'pan_zoom') {
      this.handlePanZoom(gesture);
      this.trackStillnessForModeExit(gesture, timestampMs);
      this.updateFrameHistory(gesture, timestampMs);
      return;
    }

    // Neutral: check for a swipe flick first (fast motion), otherwise
    // track stillness toward entering pan_zoom mode.
    const dt = this.lastFrameTimeMs ? (timestampMs - this.lastFrameTimeMs) / 1000 : 0;
    if (this.lastFramePosition && dt > 0) {
      const dx = gesture.position.x - this.lastFramePosition.x;
      const speed = Math.abs(dx) / dt;

      if (speed >= SWIPE_MIN_SPEED && Math.abs(dx) >= SWIPE_MIN_DISTANCE) {
        const canSwipe = timestampMs - this.lastSwipeAtMs > SWIPE_COOLDOWN_MS;
        if (canSwipe) {
          // Camera feed is unmirrored; a hand moving to the user's own
          // right decreases raw landmark x.
          this.dispatch?.({ type: dx < 0 ? 'NEXT' : 'PREVIOUS' });
          this.lastSwipeAtMs = timestampMs;
          this.stillnessAnchor = null;
        }
        this.updateFrameHistory(gesture, timestampMs);
        return;
      }
    }

    this.trackStillnessForModeEntry(gesture, timestampMs);
    this.updateFrameHistory(gesture, timestampMs);
  }

  private updateFrameHistory(gesture: SmoothedGesture, timestampMs: number): void {
    this.lastFramePosition = gesture.position;
    this.lastFrameTimeMs = timestampMs;
  }

  private trackStillnessForModeEntry(gesture: SmoothedGesture, timestampMs: number): void {
    if (!this.stillnessAnchor) {
      this.stillnessAnchor = gesture.position;
      this.stillnessSinceMs = timestampMs;
      return;
    }

    if (distance(this.stillnessAnchor, gesture.position) > STILLNESS_RADIUS) {
      this.stillnessAnchor = gesture.position;
      this.stillnessSinceMs = timestampMs;
      return;
    }

    const heldMs = timestampMs - this.stillnessSinceMs;
    const canToggle = timestampMs - this.lastModeToggleAtMs > MODE_TOGGLE_COOLDOWN_MS;
    if (heldMs >= STILLNESS_HOLD_MS && canToggle) {
      this.enterMode('pan_zoom', timestampMs);
    }
  }

  private trackStillnessForModeExit(gesture: SmoothedGesture, timestampMs: number): void {
    if (!this.stillnessAnchor) {
      this.stillnessAnchor = gesture.position;
      this.stillnessSinceMs = timestampMs;
      return;
    }

    if (distance(this.stillnessAnchor, gesture.position) > STILLNESS_RADIUS) {
      this.stillnessAnchor = gesture.position;
      this.stillnessSinceMs = timestampMs;
      return;
    }

    const heldMs = timestampMs - this.stillnessSinceMs;
    const canToggle = timestampMs - this.lastModeToggleAtMs > MODE_TOGGLE_COOLDOWN_MS;
    if (heldMs >= STILLNESS_HOLD_MS && canToggle) {
      this.enterMode('neutral', timestampMs);
    }
  }

  private enterMode(mode: GestureMode, timestampMs: number): void {
    this.mode = mode;
    this.lastModeToggleAtMs = timestampMs;
    this.stillnessAnchor = null;
    this.lastPanPosition = null;
    this.lastNormalizedPinch = null;
    this.onModeChange?.({ mode });
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

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
