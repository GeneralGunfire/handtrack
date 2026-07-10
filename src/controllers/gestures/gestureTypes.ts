export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type HandPose = 'open_palm' | 'fist' | 'thumbs_up' | 'unknown';

export interface RecognizedGesture {
  pose: HandPose;
  /** Normalized 0-1 position of the hand centroid. */
  position: Landmark;
  /** Raw thumb-tip to index-tip distance, in the same normalized units as landmarks. */
  pinchDistance: number;
  /** Wrist-to-middle-MCP distance — a stable proxy for "hand size on screen", used to
   *  normalize pinch distance so zoom sensitivity doesn't depend on distance from camera. */
  handSpan: number;
}

export type LockState = 'searching' | 'locking' | 'locked' | 'lost';
