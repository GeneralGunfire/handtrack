import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { Dispatch, GestureController as IGestureController } from '@/types/action';
import { classifyPose } from '../gestures/classifyPose';
import { GestureInterpreter } from '../gestures/GestureInterpreter';

const WASM_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type GestureControllerStatus = 'idle' | 'loading' | 'active' | 'error';

interface MediaPipeGestureControllerOptions {
  onStatusChange?: (status: GestureControllerStatus, error?: string) => void;
}

/**
 * Real hand-tracking implementation of GestureController. Reads webcam
 * frames, runs MediaPipe's HandLandmarker, classifies the pose, and feeds
 * it through GestureInterpreter to produce Actions — the same Action union
 * MouseKeyboardSource produces. InputManager and the Viewer are unaware
 * this exists versus the NoOp stub.
 */
export class MediaPipeGestureController implements IGestureController {
  private _isTracking = false;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private landmarker: HandLandmarker | null = null;
  private rafId: number | null = null;
  private interpreter = new GestureInterpreter();
  private onStatusChange?: (status: GestureControllerStatus, error?: string) => void;

  constructor(options: MediaPipeGestureControllerOptions = {}) {
    this.onStatusChange = options.onStatusChange;
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
          numHands: 1,
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
    this.onStatusChange?.('idle');
  }

  private loop = (): void => {
    if (!this._isTracking || !this.video || !this.landmarker) return;

    const timestampMs = performance.now();
    const result = this.landmarker.detectForVideo(this.video, timestampMs);

    if (result.landmarks.length > 0) {
      const gesture = classifyPose(result.landmarks[0]);
      this.interpreter.process(gesture, timestampMs);
    } else {
      this.interpreter.process(null, timestampMs);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}
