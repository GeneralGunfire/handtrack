import { AnimatePresence, motion } from 'framer-motion';
import { useViewerStore } from '@/store/viewerStore';

/** Prompt shown while gesture control is on but no hands are in view. */
export function GestureCalibrationOverlay() {
  const gestureStatus = useViewerStore((state) => state.gestureStatus);
  const handCount = useViewerStore((state) => state.gestureHands);

  const visible = gestureStatus === 'active' && handCount === 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.4 }}
          className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-center"
        >
          <div className="glass flex items-center gap-3 rounded-2xl px-6 py-4 shadow-glass">
            <PalmIcon />
            <div>
              <p className="text-sm font-medium text-ink-0">Show a hand to the camera</p>
              <p className="mt-0.5 text-xs text-ink-1">
                Pinch to rotate · pinch with both hands to zoom &amp; pan · open-palm swipe to
                switch · hold a fist to reset
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PalmIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-accent">
      <path
        d="M9 11V6a1.5 1.5 0 0 1 3 0v4M12 10V4.5a1.5 1.5 0 0 1 3 0V10M15 10V6a1.5 1.5 0 0 1 3 0v7c0 3.3-2.7 6-6 6h-1.5c-1.9 0-3.6-.9-4.7-2.4l-2.6-3.5a1.4 1.4 0 0 1 2.1-1.8L8 13.5V11a1.5 1.5 0 0 1 3 0v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
