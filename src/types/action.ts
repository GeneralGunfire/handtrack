export interface Point {
  x: number;
  y: number;
}

export type PointerSource = 'mouse' | 'hand';

export type Action =
  /** Rotate the camera around the graph. Deltas are in radians. */
  | { type: 'ORBIT'; dyaw: number; dpitch: number }
  /** Dolly toward/away from the focus point. Positive zooms in; applied multiplicatively. */
  | { type: 'ZOOM'; delta: number }
  /** Slide the camera target parallel to the view plane. Deltas are fractions of the view. */
  | { type: 'PAN'; dx: number; dy: number }
  /** Aim the targeting cursor. x/y are normalized 0..1 screen coordinates. */
  | { type: 'AIM'; x: number; y: number; source: PointerSource }
  /** Commit on whatever the cursor is aiming at (click / pinch-tap). */
  | { type: 'TAP' }
  /** Reset the camera to the framed default view. */
  | { type: 'FIT' }
  | { type: 'TOGGLE_UI' }
  /** Close preview / clear selection / reset. */
  | { type: 'EXIT' };

export type Dispatch = (action: Action) => void;

/** Anything that can push Actions into the InputManager. */
export interface InputSource {
  attach(dispatch: Dispatch): void;
  detach(): void;
}

export interface GestureController extends InputSource {
  readonly isTracking: boolean;
}
