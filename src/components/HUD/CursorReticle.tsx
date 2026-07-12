import { useGraphStore } from '@/store/graphStore';

/**
 * On-screen targeting reticle for hand control. Follows the hand cursor;
 * the ring tightens when a pinch is engaged and glows over a hovered node.
 * Hidden for mouse input — the OS cursor already shows where you're aiming.
 */
export function CursorReticle() {
  const pointer = useGraphStore((state) => state.pointer);
  const pointerSource = useGraphStore((state) => state.pointerSource);
  const pinching = useGraphStore((state) => state.pointerPinching);
  const hoveredId = useGraphStore((state) => state.hoveredId);
  const gestureStatus = useGraphStore((state) => state.gestureStatus);
  const handCount = useGraphStore((state) => state.gestureHands);

  if (gestureStatus !== 'active' || pointerSource !== 'hand' || handCount === 0) return null;

  const size = pinching ? 22 : 34;
  const active = hoveredId !== null;

  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{
        left: `${pointer.x * 100}%`,
        top: `${pointer.y * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className="rounded-full border-2 transition-all duration-100"
        style={{
          width: size,
          height: size,
          borderColor: active ? '#22d3ee' : 'rgba(255,255,255,0.6)',
          boxShadow: active ? '0 0 14px rgba(34,211,238,0.7)' : 'none',
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: active ? '#22d3ee' : 'rgba(255,255,255,0.8)' }}
      />
    </div>
  );
}
