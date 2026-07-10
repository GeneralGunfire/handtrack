import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { Dispatch, GestureController as IGestureController } from '@/types/action';
import { classifyPose } from '../gestures/classifyPose';
import { GestureInterpreter } from '../gestures/GestureInterpreter';
import { HandLockTracker } from '../gestures/HandLockTracker';
import { selectHands } from '../gestures/selectPrimaryGesture';
import type { GestureMode, Landmark, LockState } from '../gestures/gestureTypes';

export interface HandFrameUpdate {
  video: HTMLVideoElement;
  hands: Landmark[][];
}

const WASM_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/** The second hand must hold an open palm this long to trigger a full stop. */
const STOP_HOLD_MS = 400;

export type GestureControllerStatus = 'idle' | 'loading' | 'active' | 'error';

interface MediaPipeGestureControllerOptions {
  onStatusChange?: (status: GestureControllerStatus, error?: string) => void;
  onLockStateChange?: (state: LockState, progress: number) => void;
  onModeChange?: (mode: GestureMode) => void;
  /** Fired every processed frame with the raw video + landmarks, for a debug skeleton overlay. */
  onHandFrame?: (update: HandFrameUpdate) => void;
}

/**
 * Real hand-tracking implementation of GestureController. Reads webcam
 * frames, runs MediaPipe's HandLandmarker, selects a primary hand to drive
 * swipe/pan/zoom (motion-based, gated through HandLockTracker for
 * calibration + smoothing + lost detection) and a secondary hand watched
 * for the "stop" gesture (holding an open palm forces a full reset back
 * to calibration). Feeds locked frames through GestureInterpreter to
 * produce Actions — the same Action union MouseKeyboardSource produces.
 * InputManager and the Viewer are unaware this exists versus the NoOp stub.
 */
export class MediaPipeGestureController implements IGestureController {
  private _isTracking = false;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private landmarker: HandLandmarker | null = null;
  private rafId: number | null = null;
  private interpreter: GestureInterpreter;
  private lockTracker: HandLockTracker;
  private lastPrimaryPosition: Landmark | null = null;
  private stopGestureSinceMs: number | null = null;
  private onStatusChange?: (status: GestureControllerStatus, error?: string) => void;
  private onHandFrame?: (update: HandFrameUpdate) => void;

  constructor(options: MediaPipeGestureControllerOptions = {}) {
    this.onStatusChange = options.onStatusChange;
    this.onHandFrame = options.onHandFrame;
    this.interpreter = new GestureInterpreter({
      onModeChange: (change) => options.onModeChange?.(change.mode),
    });
    this.lockTracker = new HandLockTracker((change) => {
      options.onLockStateChange?.(change.state, change.lockProgress);
      if (change.state !== 'locked') {
        this.interpreter.reset();
      }
    });
  }

  get isTracking(): boolean {
    return this._isTracking;
  }

  attach(dispatch: Dispatch): void {
    this.interpreter.start(dispatch);
  }

  detach(): void {
    this.interpreter.stop();
    void this.disable();
  }

  async enable(): Promise<void> {
    if (this._isTracking) return;
    this.onStatusChange?.('loading');
    this.lockTracker.reset();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: 'user' },
        audio: false,
      });

      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.playsInline = true;
      await this.video.play();

      if (!this.landmarker) {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 2,
        });
      }

      this._isTracking = true;
      this.onStatusChange?.('active');
      this.loop();
    } catch (error) {
      this._isTracking = false;
      const message = error instanceof Error ? error.message : 'Failed to start camera';
      this.onStatusChange?.('error', message);
      await this.disable();
    }
  }

  async disable(): Promise<void> {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video = null;
    this._isTracking = false;
    this.lastPrimaryPosition = null;
    this.stopGestureSinceMs = null;
    this.lockTracker.reset();
    this.interpreter.reset();
    this.onStatusChange?.('idle');
  }

  private loop = (): void => {
    if (!this._isTracking || !this.video || !this.landmarker) return;

    const timestampMs = performance.now();
    const result = this.landmarker.detectForVideo(this.video, timestampMs);

    this.onHandFrame?.({ video: this.video, hands: result.landmarks as Landmark[][] });

    const gestures = result.landmarks.map((landmarks) => classifyPose(landmarks));
    const { primary, secondary } = selectHands(gestures, this.lastPrimaryPosition);
    this.lastPrimaryPosition = primary?.position ?? null;

    if (this.checkSecondHandStop(secondary, timestampMs)) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    const locked = this.lockTracker.process(primary, timestampMs);

    if (locked) {
      this.interpreter.process(locked, timestampMs);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  /** Returns true if the stop gesture just fired (caller should skip normal processing this frame). */
  private checkSecondHandStop(
    secondary: ReturnType<typeof selectHands>['secondary'],
    timestampMs: number,
  ): boolean {
    if (secondary?.pose !== 'open_palm') {
      this.stopGestureSinceMs = null;
      return false;
    }

    if (this.stopGestureSinceMs === null) {
      this.stopGestureSinceMs = timestampMs;
      return false;
    }

    if (timestampMs - this.stopGestureSinceMs >= STOP_HOLD_MS) {
      this.stopGestureSinceMs = null;
      this.lockTracker.reset();
      this.interpreter.reset();
      return true;
    }

    return false;
  }
}
