export interface Point {
  x: number;
  y: number;
}

export type Action =
  | { type: 'NEXT' }
  | { type: 'PREVIOUS' }
  | { type: 'SELECT'; index: number }
  | { type: 'ZOOM'; delta: number; origin?: Point }
  | { type: 'TOGGLE_ZOOM'; origin?: Point }
  | { type: 'PAN'; dx: number; dy: number }
  | { type: 'FIT' }
  | { type: 'ACTUAL_SIZE' }
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

/**
 * Future home of MediaPipe hand-tracking. Implementations translate
 * recognized gestures into Actions via the same InputSource contract,
 * so the Viewer and InputManager require no changes when this goes live.
 */
export interface GestureController extends InputSource {
  readonly isTracking: boolean;
}
