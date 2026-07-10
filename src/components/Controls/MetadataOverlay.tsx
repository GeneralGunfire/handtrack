import { useViewerStore } from '@/store/viewerStore';
import { formatBytes } from '@/utils/formatBytes';

export function MetadataOverlay() {
  const image = useViewerStore((state) => state.images[state.currentIndex]);
  const visible = useViewerStore((state) => state.metadataVisible);

  if (!image || !visible) return null;

  return (
    <div className="glass max-w-xs rounded-xl px-4 py-3 text-xs text-ink-1 shadow-glass">
      <p className="truncate font-medium text-ink-0">{image.name}</p>
      <p className="mt-1 tabular-nums">
        {image.width} × {image.height} · {formatBytes(image.size)}
      </p>
    </div>
  );
}
