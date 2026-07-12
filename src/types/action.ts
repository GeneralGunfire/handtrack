export interface Point {
  x: number;
  y: number;
}

export type Action =
  | { type: 'NEXT' }
  | { type: 'PREVIOUS' }
  | { type: 'SELECT'; index: number }
  /** Rotate the camera around the object. Deltas are in radians. */
  | { type: 'ORBIT'; dyaw: number; dpitch: number }
  /** Dolly toward/away from the object. Positive delta zooms in; applied multiplicatively. */
  | { type: 'ZOOM'; delta: number; origin?: Point }
  /** Slide the camera target parallel to the view plane, in world units. */
  | { type: 'PAN'; dx: number; dy: number }
  /** Reset the camera to its framed default view. */
  | { type: 'FIT' }
  | { type: 'TOGGLE_UI' }
  | { type: 'TOGGLE_SLIDESHOW' }
  | { type: 'START_SLIDESHOW' }
  | { type: 'STOP_SLIDESHOW' }
  | { type: 'EXIT' }
  | { type: 'CURSOR'; position: Point };

export type Dispatch = (action: Action) => void;

/** Anything that can push Actions into the InputManager. */
export interface InputSource {
  attach(dispatch: Dispatch): void;
  detach(): void;
}

export interface GestureController extends InputSource {
  readonly isTracking: boolean;
}
