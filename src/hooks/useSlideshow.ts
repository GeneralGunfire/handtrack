import { useEffect } from 'react';
import { useViewerStore } from '@/store/viewerStore';
import { useInputManager } from '@/controllers/context';

/** Drives automatic advancement while the slideshow is active. */
export function useSlideshow(): void {
  const isActive = useViewerStore((state) => state.isSlideshowActive);
  const intervalMs = useViewerStore((state) => state.slideshowIntervalMs);
  const imageCount = useViewerStore((state) => state.images.length);
  const manager = useInputManager();

  useEffect(() => {
    if (!isActive || imageCount <= 1) return;

    const interval = setInterval(() => {
      manager.next();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isActive, intervalMs, imageCount, manager]);
}
