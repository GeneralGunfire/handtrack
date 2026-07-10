import { useViewerStore } from '@/store/viewerStore';

export function ImageCounter() {
  const currentIndex = useViewerStore((state) => state.currentIndex);
  const total = useViewerStore((state) => state.images.length);

  if (total === 0) return null;

  return (
    <div className="glass rounded-full px-3.5 py-1.5 text-xs font-medium tabular-nums text-ink-1 shadow-glass">
      {currentIndex + 1} / {total}
    </div>
  );
}
