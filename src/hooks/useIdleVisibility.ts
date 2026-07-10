import { useEffect, useRef } from 'react';
import { useViewerStore } from '@/store/viewerStore';

const IDLE_TIMEOUT_MS = 2500;

/** Fades floating UI after inactivity; any pointer movement wakes it again. */
export function useIdleVisibility(): void {
  const showUI = useViewerStore((state) => state.showUI);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleHide = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        useViewerStore.setState({ uiVisible: false });
      }, IDLE_TIMEOUT_MS);
    };

    const handleActivity = () => {
      showUI();
      scheduleHide();
    };

    scheduleHide();
    window.addEventListener('pointermove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener('pointermove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [showUI]);
}
