import type { HandPose, Landmark, RecognizedGesture } from './gestureTypes';

// MediaPipe Hands landmark indices.
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

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

/**
 * A finger is "curled" when its tip sits closer to the wrist (in image-plane
 * distance) than its own PIP joint does. This is the standard MediaPipe
 * curl heuristic — comparing against the same finger's PIP joint, rather
 * than a distance ratio against the MCP, makes it hold consistently across
 * fingers of very different lengths (index vs. pinky) and stay accurate
 * even when the hand is tilted relative to the camera.
 */
function isFingerCurled(landmarks: Landmark[], tipIndex: number, pipIndex: number): boolean {
  const wrist = landmarks[WRIST];
  const tipToWrist = distance(landmarks[tipIndex], wrist);
  const pipToWrist = distance(landmarks[pipIndex], wrist);
  return tipToWrist < pipToWrist;
}

export function classifyPose(landmarks: Landmark[]): RecognizedGesture {
  const position = centroid(landmarks);
  const handSpan = distance(landmarks[WRIST], landmarks[MIDDLE_MCP]);
  const pinchDistance = distance(landmarks[THUMB_TIP], landmarks[INDEX_TIP]);

  const indexCurled = isFingerCurled(landmarks, INDEX_TIP, INDEX_PIP);
  const middleCurled = isFingerCurled(landmarks, MIDDLE_TIP, MIDDLE_PIP);
  const ringCurled = isFingerCurled(landmarks, RING_TIP, RING_PIP);
  const pinkyCurled = isFingerCurled(landmarks, PINKY_TIP, PINKY_PIP);

  const curledCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(
    Boolean,
  ).length;

  // Require 3-of-4 rather than a strict 4-of-4 so a single noisy landmark
  // reading (e.g. the pinky, which MediaPipe tracks least reliably) doesn't
  // block fist detection entirely.
  if (curledCount >= 3) {
    return { pose: 'fist', position, handSpan, pinchDistance };
  }

  if (curledCount === 0) {
    return { pose: 'open_palm', position, handSpan, pinchDistance };
  }

  return { pose: 'unknown' as HandPose, position, handSpan, pinchDistance };
}
