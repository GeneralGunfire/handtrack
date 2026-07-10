import type { LockState, Landmark, RecognizedGesture } from './gestureTypes';

const LOCK_HOLD_MS = 600;
/** Max normalized centroid movement per frame while locking-on before the timer resets. */
const LOCK_STABILITY_TOLERANCE = 0.035;
/** Frames with no hand detected before we declare the hand lost (absorbs single dropped frames). */
const LOST_AFTER_MISSED_FRAMES = 8;
const POSITION_SMOOTHING = 0.35;
const SPAN_SMOOTHING = 0.2;

export interface SmoothedGesture extends RecognizedGesture {
  /** Smoothed pinch distance normalized by hand span — stable across distance-from-camera changes. */
  normalizedPinch: number;
}

export interface LockStateChange {
  state: LockState;
  lockProgress: number;
}

/**
 * Owns the calibration lifecycle so gesture actions only fire once a hand
 * has been held steady and "locked", and freezes everything the moment
 * tracking is lost until the user re-establishes lock. Also smooths raw
 * per-frame landmarks (EMA) so hand tremor and MediaPipe jitter don't leak
 * into pan/zoom output as visible stutter.
 */
export class HandLockTracker {
  private state: LockState = 'searching';
  private lockStartPosition: Landmark | null = null;
  private lockStartTimeMs = 0;
  private missedFrames = 0;

  private smoothedPosition: Landmark | null = null;
  private smoothedSpan: number | null = null;
  private smoothedPinch: number | null = null;

  private onLockStateChange: (change: LockStateChange) => void;

  constructor(onLockStateChange: (change: LockStateChange) => void) {
    this.onLockStateChange = onLockStateChange;
  }

  get lockState(): LockState {
    return this.state;
  }

  reset(): void {
    this.setState('searching', 0);
    this.lockStartPosition = null;
    this.missedFrames = 0;
    this.smoothedPosition = null;
    this.smoothedSpan = null;
    this.smoothedPinch = null;
  }

  /** Feed one frame. Returns the smoothed gesture only when locked; null otherwise. */
  process(raw: RecognizedGesture | null, timestampMs: number): SmoothedGesture | null {
    if (!raw) {
      this.missedFrames += 1;
      if (this.state === 'locked' && this.missedFrames >= LOST_AFTER_MISSED_FRAMES) {
        this.reset();
        this.setState('lost', 0);
      } else if (this.state === 'locking') {
        this.setState('searching', 0);
        this.lockStartPosition = null;
      }
      return null;
    }
    this.missedFrames = 0;

    this.smoothedPosition = ema(this.smoothedPosition, raw.position, POSITION_SMOOTHING);
    this.smoothedSpan = emaScalar(this.smoothedSpan, raw.handSpan, SPAN_SMOOTHING);
    this.smoothedPinch = emaScalar(this.smoothedPinch, raw.pinchDistance, SPAN_SMOOTHING);

    if (this.state === 'searching' || this.state === 'lost') {
      this.setState('locking', 0);
      this.lockStartPosition = raw.position;
      this.lockStartTimeMs = timestampMs;
    } else if (this.state === 'locking') {
      const moved = this.lockStartPosition
        ? distance(this.lockStartPosition, raw.position)
        : Infinity;

      if (moved > LOCK_STABILITY_TOLERANCE) {
        this.lockStartPosition = raw.position;
        this.lockStartTimeMs = timestampMs;
        this.setState('locking', 0);
      } else {
        const elapsed = timestampMs - this.lockStartTimeMs;
        const progress = Math.min(1, elapsed / LOCK_HOLD_MS);
        this.setState('locking', progress);
        if (progress >= 1) {
          this.setState('locked', 1);
        }
      }
    }

    if (this.state !== 'locked') {
      return null;
    }

    return {
      ...raw,
      position: this.smoothedPosition,
      handSpan: this.smoothedSpan,
      pinchDistance: this.smoothedPinch,
      normalizedPinch: this.smoothedSpan > 0 ? this.smoothedPinch / this.smoothedSpan : 0,
    };
  }

  private setState(state: LockState, progress: number): void {
    const changed = state !== this.state;
    this.state = state;
    if (changed || state === 'locking') {
      this.onLockStateChange({ state, lockProgress: progress });
    }
  }
}

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function ema(prev: Landmark | null, next: Landmark, alpha: number): Landmark {
  if (!prev) return next;
  return {
    x: prev.x + (next.x - prev.x) * alpha,
    y: prev.y + (next.y - prev.y) * alpha,
    z: prev.z + (next.z - prev.z) * alpha,
  };
}

function emaScalar(prev: number | null, next: number, alpha: number): number {
  if (prev === null) return next;
  return prev + (next - prev) * alpha;
}
