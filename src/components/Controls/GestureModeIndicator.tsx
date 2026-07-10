import { AnimatePresence, motion } from 'framer-motion';
import { useViewerStore } from '@/store/viewerStore';

const MODE_LABEL: Record<'neutral' | 'pan_zoom', string> = {
  neutral: 'Identifying gesture — fist + move to swipe, palm to pan/zoom',
  pan_zoom: 'Pan & zoom — move hand to pan, pinch to zoom, palm to exit',
};

export function GestureModeIndicator() {
  const gestureStatus = useViewerStore((state) => state.gestureStatus);
  const lockState = useViewerStore((state) => state.gestureLockState);
  const mode = useViewerStore((state) => state.gestureMode);

  const visible = gestureStatus === 'active' && lockState === 'locked';

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
                mode === 'neutral' ? 'bg-ink-1' : 'bg-accent'
              }`}
            />
            {MODE_LABEL[mode]}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
