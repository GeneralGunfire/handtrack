import { AnimatePresence, motion } from 'framer-motion';
import { useGraphStore } from '@/store/graphStore';
import type { GestureMode } from '@/store/graphStore';

const MODE_LABEL: Record<GestureMode, string> = {
  idle: 'Point to aim · pinch to select · fist resets · hold 2/3/4 fingers to jump',
  orbit: 'Rotating — move your pinched hand · release to stop',
  pan_zoom: 'Zoom & pan — stretch hands apart to zoom, move together to pan',
};

export function GestureModeIndicator() {
  const gestureStatus = useGraphStore((state) => state.gestureStatus);
  const handCount = useGraphStore((state) => state.gestureHands);
  const mode = useGraphStore((state) => state.gestureMode);

  const visible = gestureStatus === 'active' && handCount > 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="glass pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-full px-4 py-2 shadow-glass"
        >
          <p className="flex items-center gap-2 text-xs font-medium text-ink-0">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                mode === 'idle' ? 'bg-ink-1' : 'bg-accent'
              }`}
            />
            {MODE_LABEL[mode]}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
