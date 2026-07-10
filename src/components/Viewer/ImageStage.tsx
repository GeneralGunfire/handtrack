import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TargetAndTransition } from 'framer-motion';
import { useViewerStore } from '@/store/viewerStore';
import { useStageBinding, stageMetricsRef } from '@/controllers/context';
import { ZoomPanLayer } from './ZoomPanLayer';
import type { TransitionType } from '@/types/image';

interface TransitionVariant {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
}

const transitionVariants: Record<TransitionType, TransitionVariant> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  dissolve: {
    initial: { opacity: 0, scale: 1.02 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
  },
  slide: {
    initial: { opacity: 0, x: 'var(--slide-enter-x, 40px)' },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 'var(--slide-exit-x, -40px)' },
  },
};

export function ImageStage() {
  const images = useViewerStore((state) => state.images);
  const currentIndex = useViewerStore((state) => state.currentIndex);
  const navDirection = useViewerStore((state) => state.navDirection);
  const zoomPan = useViewerStore((state) => state.zoomPan);
  const viewMode = useViewerStore((state) => state.viewMode);
  const transitionType = useViewerStore((state) => state.transitionType);

  const bindStageElement = useStageBinding();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bindStageElement(containerRef.current);
    return () => bindStageElement(null);
  }, [bindStageElement]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateContainerSize = () => {
      stageMetricsRef.containerSize = { width: el.clientWidth, height: el.clientHeight };
    };
    updateContainerSize();

    const observer = new ResizeObserver(updateContainerSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleContentSize = useCallback((size: { width: number; height: number }) => {
    stageMetricsRef.contentSize = size;
  }, []);

  const currentImage = images[currentIndex];
  const variant = transitionVariants[transitionType];
  const slideDirectionX = navDirection === 'forward' ? 40 : -40;

  if (!currentImage) return null;

  const fitStyle: CSSProperties = viewMode === 'fit' ? { objectFit: 'contain' } : {};

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden touch-none"
      style={{ cursor: zoomPan.scale > 1 ? 'grab' : 'default' }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentImage.id}
          initial={variant.initial}
          animate={variant.animate}
          exit={variant.exit}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={
            {
              '--slide-enter-x': `${slideDirectionX}px`,
              '--slide-exit-x': `${-slideDirectionX}px`,
              ...fitStyle,
            } as CSSProperties
          }
          className="flex h-full w-full items-center justify-center"
        >
          <ZoomPanLayer
            image={currentImage}
            scale={zoomPan.scale}
            x={zoomPan.x}
            y={zoomPan.y}
            onContentSize={handleContentSize}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
