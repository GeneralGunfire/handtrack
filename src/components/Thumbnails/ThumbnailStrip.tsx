import { useEffect, useRef } from 'react';
import { Reorder } from 'framer-motion';
import { useViewerStore } from '@/store/viewerStore';
import { useInputManager } from '@/controllers/context';
import { Thumbnail } from './Thumbnail';
import type { ImageItem } from '@/types/image';

export function ThumbnailStrip() {
  const images = useViewerStore((state) => state.images);
  const currentIndex = useViewerStore((state) => state.currentIndex);
  const reorderImages = useViewerStore((state) => state.reorderImages);
  const removeImage = useViewerStore((state) => state.removeImage);
  const manager = useInputManager();

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [currentIndex]);

  const handleReorder = (reordered: ImageItem[]) => {
    const toIndex = reordered.findIndex((img, i) => img.id !== images[i]?.id);
    if (toIndex === -1) return;

    const movedId = reordered[toIndex].id;
    const fromIndex = images.findIndex((img) => img.id === movedId);
    reorderImages(fromIndex, toIndex);
  };

  if (images.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex w-full max-w-full gap-2.5 overflow-x-auto overflow-y-hidden px-4 py-2"
      style={{ scrollbarWidth: 'none' }}
    >
      <Reorder.Group
        axis="x"
        values={images}
        onReorder={handleReorder}
        className="flex gap-2.5"
      >
        {images.map((image, index) => (
          <div key={image.id} ref={index === currentIndex ? activeRef : undefined}>
            <Thumbnail
              image={image}
              isActive={index === currentIndex}
              onSelect={() => manager.select(index)}
              onDelete={() => removeImage(image.id)}
            />
          </div>
        ))}
      </Reorder.Group>
    </div>
  );
}
