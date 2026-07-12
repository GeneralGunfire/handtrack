import type { ReactNode } from 'react';
import { useViewerStore } from '@/store/viewerStore';
import { useInputManager } from '@/controllers/context';
import { GestureToggle } from './GestureToggle';

interface IconButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}

function IconButton({ label, onClick, active, children }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
        active ? 'text-accent' : 'text-ink-1 hover:text-ink-0'
      }`}
    >
      {children}
    </button>
  );
}

export function FloatingControls() {
  const manager = useInputManager();
  const isSlideshowActive = useViewerStore((state) => state.isSlideshowActive);
  const metadataVisible = useViewerStore((state) => state.metadataVisible);
  const imageCount = useViewerStore((state) => state.images.length);

  const toggleMetadata = () =>
    useViewerStore.setState((state) => ({ metadataVisible: !state.metadataVisible }));

  if (imageCount === 0) return null;

  return (
    <div className="glass flex items-center gap-1 rounded-full px-2 py-1.5 shadow-glass">
      <IconButton label="Zoom out" onClick={() => manager.zoom(-0.25)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M21 21l-4.35-4.35M8 11h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </IconButton>

      <IconButton label="Reset view" onClick={() => manager.fitToScreen()}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </IconButton>

      <IconButton label="Zoom in" onClick={() => manager.zoom(0.25)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M21 21l-4.35-4.35M11 8v6M8 11h6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </IconButton>

      <div className="mx-1 h-5 w-px bg-white/10" />

      <IconButton
        label={isSlideshowActive ? 'Stop slideshow' : 'Start slideshow'}
        active={isSlideshowActive}
        onClick={() =>
          isSlideshowActive ? manager.stopSlideshow() : manager.startSlideshow()
        }
      >
        {isSlideshowActive ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4.5v15l13-7.5-13-7.5z" />
          </svg>
        )}
      </IconButton>

      <IconButton label="Toggle metadata" active={metadataVisible} onClick={toggleMetadata}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 11v5M12 8v.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </IconButton>

      <div className="mx-1 h-5 w-px bg-white/10" />

      <GestureToggle />
    </div>
  );
}
