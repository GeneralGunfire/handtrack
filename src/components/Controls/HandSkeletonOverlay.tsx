import { useEffect, useRef, useState } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { latestHandFrameRef } from '@/controllers/context';
import { extractFeatures } from '@/controllers/gestures/handEngine';
import type { Landmark } from '@/controllers/gestures/gestureTypes';

/** Selectable preview sizes (width in px; 4:3 aspect). */
const SIZES = [
  { label: 'S', width: 180 },
  { label: 'M', width: 260 },
  { label: 'L', width: 360 },
] as const;

// MediaPipe Hands connections between landmark indices, for drawing the skeleton.
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], // palm base
];

const HAND_COLORS = ['#22d3ee', '#f472b6'];

/**
 * Live camera panel: mirrored webcam feed with each detected hand's 21-node
 * skeleton drawn on top. The pinch nodes (thumb + index tips) light up when a
 * pinch is engaged, so you can see exactly what the tracker sees. Size is
 * adjustable via the S/M/L buttons.
 */
export function HandSkeletonOverlay() {
  const gestureStatus = useGraphStore((state) => state.gestureStatus);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [sizeIndex, setSizeIndex] = useState(1);

  const width = SIZES[sizeIndex].width;
  const height = Math.round((width * 3) / 4);

  useEffect(() => {
    if (gestureStatus !== 'active') return;

    const draw = () => {
      const canvas = canvasRef.current;
      const frame = latestHandFrameRef.current;
      if (canvas && frame) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.clearRect(0, 0, width, height);
          // Mirror horizontally so the preview matches how the user sees themselves.
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(frame.video, 0, 0, width, height);

          frame.hands.forEach((landmarks, handIndex) => {
            if (landmarks.length < 21) return;
            const pinched = extractFeatures(landmarks).pinchRatio < 0.42;
            drawHand(ctx, landmarks, HAND_COLORS[handIndex % 2], pinched, width, height);
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
  }, [gestureStatus, width, height]);

  if (gestureStatus !== 'active') return null;

  return (
    <div className="absolute bottom-28 right-5 z-30">
      <div className="glass overflow-hidden rounded-xl shadow-glass">
        <canvas ref={canvasRef} width={width} height={height} className="block" />
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-ink-1">
            Hand tracking
          </span>
          <div className="flex gap-1">
            {SIZES.map((size, i) => (
              <button
                key={size.label}
                onClick={() => setSizeIndex(i)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                  i === sizeIndex ? 'bg-white/15 text-ink-0' : 'text-ink-1 hover:text-ink-0'
                }`}
                aria-label={`Preview size ${size.label}`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  color: string,
  pinched: boolean,
  width: number,
  height: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [a, b] of CONNECTIONS) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    ctx.moveTo(pa.x * width, pa.y * height);
    ctx.lineTo(pb.x * width, pb.y * height);
  }
  ctx.stroke();

  ctx.fillStyle = color;
  landmarks.forEach((point, i) => {
    const isPinchNode = i === 4 || i === 8;
    ctx.beginPath();
    ctx.arc(
      point.x * width,
      point.y * height,
      isPinchNode && pinched ? 5 : 2.5,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = isPinchNode && pinched ? '#4ade80' : color;
    ctx.fill();
  });
}
