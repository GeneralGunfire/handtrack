export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/** One hand's 21 MediaPipe landmarks plus a timestamp for velocity tracking. */
export interface HandFrame {
  landmarks: Landmark[];
  timestampMs: number;
}

export type HandPose = 'open_palm' | 'fist' | 'pinch' | 'thumbs_up' | 'unknown';

export interface RecognizedGesture {
  pose: HandPose;
  /** Normalized 0-1 position of the hand centroid, for pan/cursor mapping. */
  position: Landmark;
  /** Pinch distance (thumb tip to index tip), present only for 'pinch'. */
  pinchDistance?: number;
}
