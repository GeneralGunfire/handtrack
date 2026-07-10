import { useEffect, useRef } from 'react';
import { useViewerStore } from '@/store/viewerStore';
import { latestHandFrameRef } from '@/controllers/context';
import type { Landmark } from '@/controllers/gestures/gestureTypes';

const PREVIEW_WIDTH = 200;
const PREVIEW_HEIGHT = 150;

// MediaPipe Hands connections between landmark indices, for drawing the skeleton.
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], // palm base
];

/** Debug visualization: draws the webcam feed with each detected hand's 21-point skeleton overlaid. */
export function HandSkeletonOverlay() {
  const gestureStatus = useViewerStore((state) => state.gestureStatus);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (gestureStatus !== 'active') return;

    const draw = () => {
      const canvas = canvasRef.current;
      const frame = latestHandFrameRef.current;
      if (canvas && frame) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
          // Mirror horizontally so the preview matches how the user sees themselves.
          ctx.translate(PREVIEW_WIDTH, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(frame.video, 0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

          frame.hands.forEach((landmarks, handIndex) => {
            drawHand(ctx, landmarks, handIndex === 0 ? '#22d3ee' : '#f472b6');
          });
          ctx.restore();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [gestureStatus]);

  if (gestureStatus !== 'active') return null;

  return (
    <div className="glass pointer-events-none absolute bottom-28 right-5 overflow-hidden rounded-xl shadow-glass">
      <canvas
        ref={canvasRef}
        width={PREVIEW_WIDTH}
        height={PREVIEW_HEIGHT}
        className="block"
      />
    </div>
  );
}

function drawHand(ctx: CanvasRenderingContext2D, landmarks: Landmark[], color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [a, b] of CONNECTIONS) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    ctx.moveTo(pa.x * PREVIEW_WIDTH, pa.y * PREVIEW_HEIGHT);
    ctx.lineTo(pb.x * PREVIEW_WIDTH, pb.y * PREVIEW_HEIGHT);
  }
  ctx.stroke();

  ctx.fillStyle = color;
  for (const point of landmarks) {
    ctx.beginPath();
    ctx.arc(point.x * PREVIEW_WIDTH, point.y * PREVIEW_HEIGHT, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
