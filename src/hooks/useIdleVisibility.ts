import { useEffect, useRef } from 'react';
import { useGraphStore } from '@/store/graphStore';

const IDLE_TIMEOUT_MS = 2500;

/** Fades floating UI after inactivity; any pointer movement wakes it again. */
export function useIdleVisibility(): void {
  const showUI = useGraphStore((state) => state.showUI);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleHide = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        useGraphStore.setState({ uiVisible: false });
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
