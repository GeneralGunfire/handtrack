import { AnimatePresence, motion } from 'framer-motion';
import { InputManagerProvider } from '@/controllers/context';
import { useViewerStore } from '@/store/viewerStore';
import { useObjectURLs } from '@/hooks/useObjectURLs';
import { useIdleVisibility } from '@/hooks/useIdleVisibility';
import { useSlideshow } from '@/hooks/useSlideshow';
import { Dropzone } from '@/components/Dropzone/Dropzone';
import { ImageStage } from '@/components/Viewer/ImageStage';
import { ThumbnailStrip } from '@/components/Thumbnails/ThumbnailStrip';
import { FloatingControls } from '@/components/Controls/FloatingControls';
import { ImageCounter } from '@/components/Controls/ImageCounter';
import { MetadataOverlay } from '@/components/Controls/MetadataOverlay';

function ViewerContent() {
  const uiVisible = useViewerStore((state) => state.uiVisible);
  const hasImages = useViewerStore((state) => state.images.length > 0);

  useObjectURLs();
  useIdleVisibility();
  useSlideshow();

  return (
    <Dropzone>
      <div className="relative flex h-full w-full flex-col">
        <div className="min-h-0 flex-1">
          <ImageStage />
        </div>

        <AnimatePresence>
          {uiVisible && hasImages && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-5"
            >
              <div className="pointer-events-auto">
                <ThumbnailStrip />
              </div>
              <div className="pointer-events-auto">
                <FloatingControls />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {uiVisible && hasImages && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute right-5 top-5"
            >
              <ImageCounter />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pointer-events-none absolute left-5 top-5">
          <MetadataOverlay />
        </div>
      </div>
    </Dropzone>
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
