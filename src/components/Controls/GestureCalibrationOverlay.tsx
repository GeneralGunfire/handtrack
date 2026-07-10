import { AnimatePresence, motion } from 'framer-motion';
import { useViewerStore } from '@/store/viewerStore';

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function GestureCalibrationOverlay() {
  const gestureStatus = useViewerStore((state) => state.gestureStatus);
  const lockState = useViewerStore((state) => state.gestureLockState);
  const lockProgress = useViewerStore((state) => state.gestureLockProgress);

  const visible = gestureStatus === 'active' && lockState !== 'locked';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
        >
          <div className="glass flex flex-col items-center gap-4 rounded-2xl px-8 py-7 shadow-glass">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r={RADIUS}
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="4"
                />
                <motion.circle
                  cx="40"
                  cy="40"
                  r={RADIUS}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  animate={{
                    strokeDashoffset: CIRCUMFERENCE * (1 - (lockState === 'locking' ? lockProgress : 0)),
                  }}
                  transition={{ duration: 0.1, ease: 'linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <PalmIcon lost={lockState === 'lost'} />
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-ink-0">
                {lockState === 'lost' ? 'Hand lost' : 'Show your palm to calibrate'}
              </p>
              <p className="mt-1 text-xs text-ink-1">
                {lockState === 'lost'
                  ? 'Raise your palm to reconnect'
                  : 'Hold it steady, facing the camera'}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PalmIcon({ lost }: { lost: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className={lost ? 'text-red-400' : 'text-accent'}>
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
