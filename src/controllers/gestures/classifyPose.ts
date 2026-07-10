import type { HandPose, Landmark, RecognizedGesture } from './gestureTypes';

// MediaPipe Hands landmark indices.
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_TIP = 16;
const PINKY_MCP = 17;
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

export function classifyPose(landmarks: Landmark[]): RecognizedGesture {
  const position = centroid(landmarks);
  const handSpan = distance(landmarks[WRIST], landmarks[MIDDLE_MCP]);
  const pinchDistance = distance(landmarks[THUMB_TIP], landmarks[INDEX_TIP]);

  const indexCurled = isFingerCurled(landmarks, INDEX_TIP, INDEX_MCP);
  const middleCurled = isFingerCurled(landmarks, MIDDLE_TIP, MIDDLE_MCP);
  const ringCurled = isFingerCurled(landmarks, RING_TIP, RING_MCP);
  const pinkyCurled = isFingerCurled(landmarks, PINKY_TIP, PINKY_MCP);

  const fingersCurled = [indexCurled, middleCurled, ringCurled, pinkyCurled];

  if (fingersCurled.every(Boolean)) {
    return { pose: 'fist', position, handSpan, pinchDistance };
  }

  if (fingersCurled.every((curled) => !curled)) {
    return { pose: 'open_palm', position, handSpan, pinchDistance };
  }

  return { pose: 'unknown' as HandPose, position, handSpan, pinchDistance };
}
