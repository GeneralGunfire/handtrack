import { memo, useEffect, useRef } from 'react';
import type { ImageItem } from '@/types/image';

interface ZoomPanLayerProps {
  image: ImageItem;
  scale: number;
  x: number;
  y: number;
  onContentSize: (size: { width: number; height: number }) => void;
}

/**
 * Renders the image with a GPU-composited transform. Zoom/pan values come
 * from the store as plain numbers; applying them via a CSS transform (not
 * layout or React re-render of children) keeps this on the compositor
 * thread for smooth 60fps interaction.
 */
export const ZoomPanLayer = memo(function ZoomPanLayer({
  image,
  scale,
  x,
  y,
  onContentSize,
}: ZoomPanLayerProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    const reportSize = () => {
      if (el.naturalWidth && el.naturalHeight) {
        onContentSize({ width: el.naturalWidth, height: el.naturalHeight });
      }
    };

    if (el.complete) reportSize();
    el.addEventListener('load', reportSize);
    return () => el.removeEventListener('load', reportSize);
  }, [image.url, onContentSize]);

  return (
    <img
      ref={imgRef}
      src={image.url}
      alt={image.name}
      draggable={false}
      className="max-h-full max-w-full select-none will-change-transform"
      style={{
        transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
        transformOrigin: 'center center',
      }}
    />
  );
});
