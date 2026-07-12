import { AnimatePresence, motion } from 'framer-motion';
import { InputManagerProvider } from '@/controllers/context';
import { useGraphStore } from '@/store/graphStore';
import { useIdleVisibility } from '@/hooks/useIdleVisibility';
import { GraphViewer } from '@/components/GraphViewer/GraphViewer';
import { HudHeader } from '@/components/HUD/HudHeader';
import { SearchBar } from '@/components/HUD/SearchBar';
import { NodeDetailsPanel } from '@/components/HUD/NodeDetailsPanel';
import { CursorReticle } from '@/components/HUD/CursorReticle';
import { FloatingControls } from '@/components/Controls/FloatingControls';
import { GestureCalibrationOverlay } from '@/components/Controls/GestureCalibrationOverlay';
import { GestureModeIndicator } from '@/components/Controls/GestureModeIndicator';
import { HandSkeletonOverlay } from '@/components/Controls/HandSkeletonOverlay';

function ViewerContent() {
  const uiVisible = useGraphStore((state) => state.uiVisible);

  useIdleVisibility();

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">
        <GraphViewer />
      </div>

      <HudHeader />
      <CursorReticle />

      <AnimatePresence>
        {uiVisible && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 pb-5"
          >
            <div className="pointer-events-auto">
              <SearchBar />
            </div>
            <div className="pointer-events-auto">
              <FloatingControls />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <NodeDetailsPanel />
      <GestureCalibrationOverlay />
      <GestureModeIndicator />
      <HandSkeletonOverlay />
    </div>
  );
}

export function AppShell() {
  return (
    <InputManagerProvider>
      <div className="h-screen w-screen overflow-hidden bg-surface-0">
        <ViewerContent />
      </div>
    </InputManagerProvider>
  );
}
