import { memo } from 'react';
import { Reorder, motion } from 'framer-motion';
import type { ImageItem } from '@/types/image';

interface ThumbnailProps {
  image: ImageItem;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export const Thumbnail = memo(function Thumbnail({
  image,
  isActive,
  onSelect,
  onDelete,
}: ThumbnailProps) {
  return (
    <Reorder.Item
      value={image}
      className="group relative flex-shrink-0 cursor-pointer"
      whileDrag={{ scale: 1.05, zIndex: 10 }}
    >
      <motion.button
        onClick={onSelect}
        className="relative block h-16 w-16 overflow-hidden rounded-lg"
        animate={{
          boxShadow: isActive
            ? '0 0 0 2px var(--color-accent), 0 4px 16px rgba(34, 211, 238, 0.25)'
            : '0 0 0 1px rgba(255,255,255,0.06)',
        }}
        transition={{ duration: 0.2 }}
      >
        <img
          src={image.url}
          alt={image.name}
          draggable={false}
          className="h-full w-full object-cover"
          style={{ opacity: isActive ? 1 : 0.55 }}
        />
      </motion.button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Remove ${image.name}`}
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-ink-1 opacity-0 shadow-soft transition-opacity hover:text-ink-0 group-hover:opacity-100"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path
            d="M18 6 6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </Reorder.Item>
  );
});
