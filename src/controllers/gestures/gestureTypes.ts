export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/** Stable per-hand measurements derived from the 21 MediaPipe landmarks. */
export interface HandFeatures {
  /** Average of wrist + finger MCP knuckles — the most stable point on the hand. */
  palm: Landmark;
  /** Midpoint between thumb tip and index tip — the "grab point" while pinching. */
  pinchPoint: Landmark;
  /** Wrist-to-middle-MCP distance; proxy for hand size on screen. Normalizes pinch. */
  handSpan: number;
  /** Thumb-tip to index-tip distance divided by handSpan. Small = pinching. */
  pinchRatio: number;
  /** How many of index/middle/ring/pinky are extended. 0 = fist, 4 = open palm. */
  extendedFingers: number;
}

export type PinchPhase = 'released' | 'starting' | 'pinched' | 'ending';

export type GestureMode = 'idle' | 'orbit' | 'pan_zoom';
