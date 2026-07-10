import type { HandPose, Landmark, RecognizedGesture } from './gestureTypes';

// MediaPipe Hands landmark indices.
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_TIP = 20;

const CURL_RATIO_THRESHOLD = 0.75;

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function centroid(landmarks: Landmark[]): Landmark {
  const wrist = landmarks[WRIST];
  const middleMcp = landmarks[MIDDLE_MCP];
  return {
    x: (wrist.x + middleMcp.x) / 2,
    y: (wrist.y + middleMcp.y) / 2,
    z: (wrist.z + middleMcp.z) / 2,
  };
}

/** A finger is "curled" when its tip sits closer to the wrist than its MCP joint does. */
function isFingerCurled(landmarks: Landmark[], tipIndex: number, mcpIndex: number): boolean {
  const wrist = landmarks[WRIST];
  const tipToWrist = distance(landmarks[tipIndex], wrist);
  const mcpToWrist = distance(landmarks[mcpIndex], wrist);
  return tipToWrist < mcpToWrist * CURL_RATIO_THRESHOLD;
}

function isThumbsUp(landmarks: Landmark[]): boolean {
  const thumbTip = landmarks[THUMB_TIP];
  const wrist = landmarks[WRIST];
  const indexCurled = isFingerCurled(landmarks, INDEX_TIP, INDEX_MCP);
  const middleCurled = isFingerCurled(landmarks, MIDDLE_TIP, MIDDLE_MCP);
  const thumbExtendedUp = thumbTip.y < wrist.y - 0.08;
  return indexCurled && middleCurled && thumbExtendedUp;
}

/**
 * Classifies discrete pose (for swipe/pan/slideshow gestures) but always
 * reports pinchDistance/handSpan as continuous measurements — zoom is
 * driven by smoothed distance tracking in HandLockTracker, not by crossing
 * a pose threshold, since that caused zoom to snap back when fingers
 * relaxed even slightly.
 */
export function classifyPose(landmarks: Landmark[]): RecognizedGesture {
  const position = centroid(landmarks);
  const pinchDistance = distance(landmarks[THUMB_TIP], landmarks[INDEX_TIP]);
  const handSpan = distance(landmarks[WRIST], landmarks[MIDDLE_MCP]);

  if (isThumbsUp(landmarks)) {
    return { pose: 'thumbs_up', position, pinchDistance, handSpan };
  }

  const fingersCurled = [
    isFingerCurled(landmarks, INDEX_TIP, INDEX_MCP),
    isFingerCurled(landmarks, MIDDLE_TIP, MIDDLE_MCP),
    isFingerCurled(landmarks, RING_TIP, MIDDLE_MCP),
    isFingerCurled(landmarks, PINKY_TIP, MIDDLE_MCP),
  ];

  if (fingersCurled.every(Boolean)) {
    return { pose: 'fist', position, pinchDistance, handSpan };
  }

  if (fingersCurled.every((curled) => !curled)) {
    return { pose: 'open_palm', position, pinchDistance, handSpan };
  }

  return { pose: 'unknown' as HandPose, position, pinchDistance, handSpan };
}
