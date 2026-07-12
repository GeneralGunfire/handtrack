import type { Dispatch } from '@/types/action';
import type { GestureMode, HandFeatures, Landmark, PinchPhase } from './gestureTypes';

/*
 * Two-hand gesture engine for the codebase graph.
 *
 * Pipeline per frame (landmarks are treated as a noisy sensor):
 *   raw landmarks -> mirror -> features -> identity tracking -> smoothing
 *   -> pinch state machine (hysteresis + confirm frames) -> mode selection
 *   -> relative deltas -> Actions.
 *
 * Gesture vocabulary (point = aim, pinch = commit, spread = scale):
 *   - Point / move a hand         -> AIM: drives the targeting reticle.
 *   - Quick pinch (tap)           -> TAP: select / expand whatever is aimed at.
 *   - Pinch + drag                -> ORBIT: rotate around the graph.
 *   - Both hands pinched          -> PAN + ZOOM: stretch to zoom, move together to pan.
 *   - Fist held ~0.6s             -> FIT: reset the view.
 *
 * A pinch starts "undecided": if the hand travels beyond a small threshold it
 * becomes a drag (orbit); if it releases quickly without moving it was a tap.
 * That keeps selection and camera control on one gesture without conflicts.
 */

// -- Tuning ------------------------------------------------------------------

/** Pinch enters below this thumb-index/handSpan ratio... */
const PINCH_ENTER_RATIO = 0.42;
/** ...and only releases above this one (hysteresis gap prevents flicker). */
const PINCH_EXIT_RATIO = 0.62;
/** Consecutive frames a pinch/release must hold before it is confirmed. */
const CONFIRM_FRAMES = 3;

/** EMA smoothing factors: heavier smoothing when the hand is slow (jitter),
 *  lighter when it moves fast (responsiveness) — a One-Euro-style tradeoff. */
const SMOOTH_MIN_ALPHA = 0.18;
const SMOOTH_MAX_ALPHA = 0.65;
const SMOOTH_SPEED_SCALE = 30;

/** Ignore per-frame smoothed movement below this (normalized units). */
const DEAD_ZONE = 0.0012;

/** Pinch travel beyond this becomes a drag; release before it is a tap. */
const TAP_MOVE_THRESHOLD = 0.022;
/** A pinch longer than this can no longer count as a tap. */
const TAP_MAX_MS = 500;

/** Radians of yaw per full screen-width of hand travel. */
const ORBIT_GAIN_X = 4.2;
const ORBIT_GAIN_Y = 3.2;
/** Max radians one frame may apply — hard clamp against jumps. */
const MAX_ORBIT_STEP = 0.14;

const ZOOM_GAIN = 1.9;
const MAX_ZOOM_STEP = 0.09;
const PAN_GAIN = 1.35;
const MAX_PAN_STEP = 0.06;

const FIST_HOLD_MS = 600;
const FIST_COOLDOWN_MS = 1500;

/** A tracked hand is dropped if unseen for this long. */
const HAND_TIMEOUT_MS = 160;
/** Max palm distance for identity matching between frames. */
const MATCH_RADIUS = 0.35;

// -- Feature extraction --------------------------------------------------------

const PALM_INDICES = [0, 5, 9, 13, 17];
const FINGERS: Array<[tip: number, pip: number]> = [
  [8, 6],
  [12, 10],
  [16, 14],
  [20, 18],
];

function dist2d(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Compute stable features from raw landmarks. `x` is mirrored so that moving
 *  your hand to the right increases x — matching what the user sees. */
export function extractFeatures(raw: Landmark[]): HandFeatures {
  const lm = raw.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));

  let px = 0;
  let py = 0;
  for (const i of PALM_INDICES) {
    px += lm[i].x;
    py += lm[i].y;
  }
  const palm = { x: px / PALM_INDICES.length, y: py / PALM_INDICES.length, z: 0 };

  const handSpan = Math.max(dist2d(lm[0], lm[9]), 1e-4);
  const pinchDistance = dist2d(lm[4], lm[8]);
  const pinchPoint = {
    x: (lm[4].x + lm[8].x) / 2,
    y: (lm[4].y + lm[8].y) / 2,
    z: 0,
  };

  const wrist = lm[0];
  let extendedFingers = 0;
  for (const [tip, pip] of FINGERS) {
    if (dist2d(lm[tip], wrist) > dist2d(lm[pip], wrist) * 1.12) {
      extendedFingers += 1;
    }
  }

  const indexExtended = dist2d(lm[8], wrist) > dist2d(lm[6], wrist) * 1.12;

  return {
    palm,
    pinchPoint,
    indexTip: { ...lm[8] },
    indexExtended,
    handSpan,
    pinchRatio: pinchDistance / handSpan,
    extendedFingers,
  };
}

// -- Per-hand tracking ---------------------------------------------------------

interface TrackedHand {
  palm: Landmark;
  pinchPoint: Landmark;
  /** Smoothed aiming point: index fingertip when pointing, else the pinch point. */
  aimPoint: Landmark;
  features: HandFeatures;
  phase: PinchPhase;
  /** Frames the raw pinch reading has disagreed with the confirmed phase. */
  transitionFrames: number;
  lastSeenMs: number;
  /** Pinch-tap bookkeeping. */
  pinchStartMs: number;
  pinchStart: Landmark | null;
  dragging: boolean;
  fistSinceMs: number | null;
}

function smooth(prev: Landmark, next: Landmark, dtSec: number): Landmark {
  const speed = dist2d(prev, next) / Math.max(dtSec, 1 / 120);
  const alpha = Math.min(
    SMOOTH_MAX_ALPHA,
    Math.max(SMOOTH_MIN_ALPHA, speed / SMOOTH_SPEED_SCALE + SMOOTH_MIN_ALPHA),
  );
  return {
    x: prev.x + (next.x - prev.x) * alpha,
    y: prev.y + (next.y - prev.y) * alpha,
    z: 0,
  };
}

// -- Engine --------------------------------------------------------------------

export interface HandEngineCallbacks {
  onModeChange?: (mode: GestureMode) => void;
  onHandCountChange?: (count: number) => void;
  onPinchChange?: (pinching: boolean) => void;
}

export class HandEngine {
  private dispatch: Dispatch | null = null;
  private hands: TrackedHand[] = [];
  private mode: GestureMode = 'idle';
  private lastFrameMs = 0;
  private reportedHandCount = -1;
  private reportedPinching = false;

  /** Previous-frame anchors for relative mapping; null = re-prime next frame. */
  private orbitAnchor: Landmark | null = null;
  private zoomPanAnchor: { span: number; mid: Landmark } | null = null;

  private lastFistResetMs = 0;

  private callbacks: HandEngineCallbacks;

  constructor(callbacks: HandEngineCallbacks = {}) {
    this.callbacks = callbacks;
  }

  start(dispatch: Dispatch): void {
    this.dispatch = dispatch;
  }

  stop(): void {
    this.dispatch = null;
    this.reset();
  }

  reset(): void {
    this.hands = [];
    this.orbitAnchor = null;
    this.zoomPanAnchor = null;
    this.setMode('idle');
    this.reportPinching(false);
    if (this.reportedHandCount !== 0) {
      this.reportedHandCount = 0;
      this.callbacks.onHandCountChange?.(0);
    }
  }

  process(rawHands: Landmark[][], nowMs: number): void {
    if (!this.dispatch) return;
    const dtSec = this.lastFrameMs ? Math.min((nowMs - this.lastFrameMs) / 1000, 0.1) : 1 / 30;
    this.lastFrameMs = nowMs;

    this.updateTracking(rawHands, nowMs, dtSec);

    if (this.hands.length !== this.reportedHandCount) {
      this.reportedHandCount = this.hands.length;
      this.callbacks.onHandCountChange?.(this.hands.length);
    }

    const pinched = this.hands.filter((h) => h.phase === 'pinched');
    this.reportPinching(pinched.length > 0);

    // The aiming hand drives the reticle: prefer the pinched hand, else the first.
    const aimHand = pinched[0] ?? this.hands[0];
    if (aimHand) {
      this.dispatch({ type: 'AIM', x: aimHand.aimPoint.x, y: aimHand.aimPoint.y, source: 'hand' });
    }

    if (pinched.length >= 2) {
      this.setMode('pan_zoom');
      this.orbitAnchor = null;
      // A second pinch joins in: neither pinch can be a tap anymore.
      for (const hand of pinched) hand.dragging = true;
      this.runPanZoom(pinched[0], pinched[1]);
    } else if (pinched.length === 1) {
      this.zoomPanAnchor = null;
      this.runSinglePinch(pinched[0], nowMs);
    } else {
      this.setMode('idle');
      this.orbitAnchor = null;
      this.zoomPanAnchor = null;
      this.runIdleGestures(nowMs);
    }
  }

  // -- tracking & pinch state machine --

  private updateTracking(rawHands: Landmark[][], nowMs: number, dtSec: number): void {
    const detections = rawHands
      .filter((lm) => lm.length >= 21)
      .map((lm) => extractFeatures(lm));

    const unclaimed = new Set(detections.map((_, i) => i));

    // Match existing tracked hands to nearest detection.
    for (const hand of this.hands) {
      let bestIdx = -1;
      let bestDist = MATCH_RADIUS;
      for (const i of unclaimed) {
        const d = dist2d(hand.palm, detections[i].palm);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        unclaimed.delete(bestIdx);
        this.updateHand(hand, detections[bestIdx], nowMs, dtSec);
      }
    }

    // Spawn new tracked hands (max 2).
    for (const i of unclaimed) {
      if (this.hands.length >= 2) break;
      const f = detections[i];
      this.hands.push({
        palm: f.palm,
        pinchPoint: f.pinchPoint,
        aimPoint: f.indexExtended ? f.indexTip : f.pinchPoint,
        features: f,
        phase: 'released',
        transitionFrames: 0,
        lastSeenMs: nowMs,
        pinchStartMs: 0,
        pinchStart: null,
        dragging: false,
        fistSinceMs: null,
      });
    }

    // Drop stale hands. A pinch that vanishes mid-air is never a tap.
    this.hands = this.hands.filter((h) => nowMs - h.lastSeenMs < HAND_TIMEOUT_MS);
  }

  private updateHand(hand: TrackedHand, f: HandFeatures, nowMs: number, dtSec: number): void {
    hand.palm = smooth(hand.palm, f.palm, dtSec);
    hand.pinchPoint = smooth(hand.pinchPoint, f.pinchPoint, dtSec);
    const rawAim = hand.phase === 'pinched' || !f.indexExtended ? f.pinchPoint : f.indexTip;
    hand.aimPoint = smooth(hand.aimPoint, rawAim, dtSec);
    hand.features = f;
    hand.lastSeenMs = nowMs;

    // Pinch state machine: the raw reading must disagree with the confirmed
    // state for CONFIRM_FRAMES consecutive frames before the state flips.
    const rawPinched = f.pinchRatio < PINCH_ENTER_RATIO;
    const rawReleased = f.pinchRatio > PINCH_EXIT_RATIO;
    const isPinched = hand.phase === 'pinched';

    if ((isPinched && rawReleased) || (!isPinched && rawPinched)) {
      hand.transitionFrames += 1;
      if (hand.transitionFrames >= CONFIRM_FRAMES) {
        hand.transitionFrames = 0;
        if (isPinched) {
          hand.phase = 'released';
          this.onPinchReleased(hand, nowMs);
        } else {
          hand.phase = 'pinched';
          hand.pinchStartMs = nowMs;
          hand.pinchStart = { ...hand.pinchPoint };
          hand.dragging = false;
        }
      }
    } else {
      hand.transitionFrames = 0;
    }

    // Fist = all four fingers curled while not pinching.
    const isFist = f.extendedFingers === 0 && hand.phase !== 'pinched';
    if (isFist) {
      hand.fistSinceMs ??= nowMs;
    } else {
      hand.fistSinceMs = null;
    }
  }

  private onPinchReleased(hand: TrackedHand, nowMs: number): void {
    const duration = nowMs - hand.pinchStartMs;
    if (!hand.dragging && duration <= TAP_MAX_MS) {
      this.dispatch?.({ type: 'TAP' });
    }
    hand.pinchStart = null;
    hand.dragging = false;
    this.orbitAnchor = null;
  }

  // -- modes --

  /** One pinched hand: undecided until it moves (drag/orbit) or releases (tap). */
  private runSinglePinch(hand: TrackedHand, nowMs: number): void {
    if (!hand.dragging) {
      const travel = hand.pinchStart ? dist2d(hand.pinchPoint, hand.pinchStart) : 0;
      const expired = nowMs - hand.pinchStartMs > TAP_MAX_MS;
      if (travel < TAP_MOVE_THRESHOLD && !expired) {
        this.setMode('idle');
        return; // Still might be a tap — hold fire.
      }
      hand.dragging = true;
      this.orbitAnchor = null;
    }

    this.setMode('orbit');
    const p = hand.pinchPoint;
    if (!this.orbitAnchor) {
      this.orbitAnchor = { ...p };
      return;
    }
    const dx = p.x - this.orbitAnchor.x;
    const dy = p.y - this.orbitAnchor.y;
    this.orbitAnchor = { ...p };

    if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return;

    const dyaw = clampStep(dx * ORBIT_GAIN_X, MAX_ORBIT_STEP);
    const dpitch = clampStep(dy * ORBIT_GAIN_Y, MAX_ORBIT_STEP);
    this.dispatch?.({ type: 'ORBIT', dyaw, dpitch });
  }

  private runPanZoom(a: TrackedHand, b: TrackedHand): void {
    const span = dist2d(a.pinchPoint, b.pinchPoint);
    const mid = {
      x: (a.pinchPoint.x + b.pinchPoint.x) / 2,
      y: (a.pinchPoint.y + b.pinchPoint.y) / 2,
      z: 0,
    };

    if (!this.zoomPanAnchor) {
      this.zoomPanAnchor = { span, mid };
      return;
    }

    const zoomDelta = span / Math.max(this.zoomPanAnchor.span, 1e-4) - 1;
    const dx = mid.x - this.zoomPanAnchor.mid.x;
    const dy = mid.y - this.zoomPanAnchor.mid.y;
    this.zoomPanAnchor = { span, mid };

    if (Math.abs(zoomDelta) > DEAD_ZONE) {
      this.dispatch?.({ type: 'ZOOM', delta: clampStep(zoomDelta * ZOOM_GAIN, MAX_ZOOM_STEP) });
    }
    if (Math.abs(dx) > DEAD_ZONE || Math.abs(dy) > DEAD_ZONE) {
      this.dispatch?.({
        type: 'PAN',
        dx: clampStep(dx * PAN_GAIN, MAX_PAN_STEP),
        dy: clampStep(dy * PAN_GAIN, MAX_PAN_STEP),
      });
    }
  }

  private runIdleGestures(nowMs: number): void {
    for (const hand of this.hands) {
      if (
        hand.fistSinceMs !== null &&
        nowMs - hand.fistSinceMs >= FIST_HOLD_MS &&
        nowMs - this.lastFistResetMs >= FIST_COOLDOWN_MS
      ) {
        this.lastFistResetMs = nowMs;
        hand.fistSinceMs = null;
        this.dispatch?.({ type: 'FIT' });
      }
    }
  }

  private setMode(mode: GestureMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.callbacks.onModeChange?.(mode);
  }

  private reportPinching(pinching: boolean): void {
    if (this.reportedPinching === pinching) return;
    this.reportedPinching = pinching;
    this.callbacks.onPinchChange?.(pinching);
  }
}

function clampStep(value: number, max: number): number {
  return Math.max(-max, Math.min(max, value));
}
