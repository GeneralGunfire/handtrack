import { useEffect, useRef } from 'react';
import { useViewerStore } from '@/store/viewerStore';

/**
 * Revokes object URLs as images are removed from the store, and revokes
 * all remaining URLs on unmount. Keeps createObjectURL/revokeObjectURL
 * lifecycle in one place instead of scattering it across components.
 */
export function useObjectURLs(): void {
  const images = useViewerStore((state) => state.images);
  const knownUrls = useRef(new Set<string>());

  useEffect(() => {
    const currentUrls = new Set(images.map((img) => img.url));

    for (const url of knownUrls.current) {
      if (!currentUrls.has(url)) {
        URL.revokeObjectURL(url);
      }
    }
    knownUrls.current = currentUrls;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const url of knownUrls.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);
}
