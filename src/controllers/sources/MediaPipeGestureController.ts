import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { Dispatch, GestureController as IGestureController } from '@/types/action';
import { HandEngine } from '../gestures/handEngine';
import type { GestureMode, Landmark } from '../gestures/gestureTypes';

export interface HandFrameUpdate {
  video: HTMLVideoElement;
  hands: Landmark[][];
}

const WASM_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type GestureControllerStatus = 'idle' | 'loading' | 'active' | 'error';

interface MediaPipeGestureControllerOptions {
  onStatusChange?: (status: GestureControllerStatus, error?: string) => void;
  onModeChange?: (mode: GestureMode) => void;
  onHandCountChange?: (count: number) => void;
  onPinchChange?: (pinching: boolean) => void;
  /** Fired every processed frame with the raw video + landmarks, for the hand preview panel. */
  onHandFrame?: (update: HandFrameUpdate) => void;
}

/**
 * Camera + landmark layer of the gesture stack. Owns the webcam stream and
 * MediaPipe's two-hand HandLandmarker; every frame's landmarks are handed to
 * HandEngine, which does all smoothing, gesture recognition and Action
 * dispatch. Low-confidence frames are filtered out here before they reach
 * the engine.
 */
export class MediaPipeGestureController implements IGestureController {
  private _isTracking = false;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private landmarker: HandLandmarker | null = null;
  private rafId: number | null = null;
  private engine: HandEngine;
  private onStatusChange?: (status: GestureControllerStatus, error?: string) => void;
  private onHandFrame?: (update: HandFrameUpdate) => void;
  private lastVideoTimeMs = -1;

  constructor(options: MediaPipeGestureControllerOptions = {}) {
    this.onStatusChange = options.onStatusChange;
    this.onHandFrame = options.onHandFrame;
    this.engine = new HandEngine({
      onModeChange: options.onModeChange,
      onHandCountChange: options.onHandCountChange,
      onPinchChange: options.onPinchChange,
    });
  }

  get isTracking(): boolean {
    return this._isTracking;
  }

  attach(dispatch: Dispatch): void {
    this.engine.start(dispatch);
  }

  detach(): void {
    this.engine.stop();
    void this.disable();
  }

  async enable(): Promise<void> {
    if (this._isTracking) return;
    this.onStatusChange?.('loading');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });

      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.playsInline = true;
      this.video.muted = true;
      await this.video.play();

      if (!this.landmarker) {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
      }

      this._isTracking = true;
      this.engine.reset();
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
    this.lastVideoTimeMs = -1;
    this.engine.reset();
    this.onStatusChange?.('idle');
  }

  private loop = (): void => {
    if (!this._isTracking || !this.video || !this.landmarker) return;

    const timestampMs = performance.now();

    // Only run detection on new video frames; rAF often outpaces the camera.
    if (this.video.currentTime * 1000 !== this.lastVideoTimeMs) {
      this.lastVideoTimeMs = this.video.currentTime * 1000;
      const result = this.landmarker.detectForVideo(this.video, timestampMs);

      const hands = result.landmarks as Landmark[][];
      this.onHandFrame?.({ video: this.video, hands });
      this.engine.process(hands, timestampMs);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}
