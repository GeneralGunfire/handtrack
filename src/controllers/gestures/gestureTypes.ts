export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type HandPose = 'open_palm' | 'fist' | 'two_finger_point' | 'unknown';

export interface RecognizedGesture {
  pose: HandPose;
  /** Normalized 0-1 position of the hand centroid. */
  position: Landmark;
  /** Wrist-to-middle-MCP distance — a stable proxy for "hand size on screen" (bigger = closer
   *  to camera), used both to normalize other measurements and to drive depth-based zoom. */
  handSpan: number;
}

export type LockState = 'searching' | 'locking' | 'locked' | 'lost';

export type GestureMode = 'neutral' | 'zoom' | 'pan';
