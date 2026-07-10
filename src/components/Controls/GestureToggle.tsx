import { useState } from 'react';
import { useViewerStore } from '@/store/viewerStore';
import { useGestureControls } from '@/controllers/context';

export function GestureToggle() {
  const status = useViewerStore((state) => state.gestureStatus);
  const error = useViewerStore((state) => state.gestureError);
  const { enable, disable } = useGestureControls();
  const [showError, setShowError] = useState(false);

  const isActive = status === 'active';
  const isLoading = status === 'loading';

  const handleClick = async () => {
    setShowError(false);
    if (isActive || isLoading) {
      await disable();
    } else {
      await enable();
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        aria-label={isActive ? 'Disable hand gesture control' : 'Enable hand gesture control'}
        title={isActive ? 'Disable hand gesture control' : 'Enable hand gesture control'}
        onMouseEnter={() => status === 'error' && setShowError(true)}
        onMouseLeave={() => setShowError(false)}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
          isActive ? 'text-accent' : status === 'error' ? 'text-red-400' : 'text-ink-1 hover:text-ink-0'
        }`}
      >
        {isLoading ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="40"
              strokeDashoffset="10"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 11V6a1.5 1.5 0 0 1 3 0v4M12 10V4.5a1.5 1.5 0 0 1 3 0V10M15 10V6a1.5 1.5 0 0 1 3 0v7c0 3.3-2.7 6-6 6h-1.5c-1.9 0-3.6-.9-4.7-2.4l-2.6-3.5a1.4 1.4 0 0 1 2.1-1.8L8 13.5V11a1.5 1.5 0 0 1 3 0v3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {showError && error && (
        <div className="glass absolute bottom-full right-0 mb-2 w-56 rounded-lg px-3 py-2 text-xs text-ink-1 shadow-glass">
          {error}
        </div>
      )}
    </div>
  );
}
