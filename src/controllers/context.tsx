import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { InputManager } from './InputManager';
import { MouseKeyboardSource } from './sources/MouseKeyboardSource';
import { MediaPipeGestureController } from './sources/MediaPipeGestureController';
import type { HandFrameUpdate } from './sources/MediaPipeGestureController';
import { useViewerStore } from '@/store/viewerStore';
import { computeActualScale, MAX_SCALE, MIN_SCALE } from '@/utils/geometry';
import { clamp } from '@/utils/clamp';

/** Latest webcam frame + hand landmarks, updated outside React state so the
 *  debug skeleton overlay can read it in its own rAF loop without causing
 *  a re-render on every camera frame. */
export const latestHandFrameRef: { current: HandFrameUpdate | null } = { current: null };

interface InputManagerContextValue {
  manager: InputManager;
  bindStageElement: (element: HTMLElement | null) => void;
  enableGestures: () => Promise<void>;
  disableGestures: () => Promise<void>;
}

const InputManagerContext = createContext<InputManagerContextValue | null>(null);

export function useInputManager(): InputManager {
  const ctx = useContext(InputManagerContext);
  if (!ctx) {
    throw new Error('useInputManager must be used within InputManagerProvider');
  }
  return ctx.manager;
}

/** Attaches the pointer/wheel listeners of the mouse-keyboard source to the viewer stage element. */
export function useStageBinding(): (element: HTMLElement | null) => void {
  const ctx = useContext(InputManagerContext);
  if (!ctx) {
    throw new Error('useStageBinding must be used within InputManagerProvider');
  }
  return ctx.bindStageElement;
}

/** Exposes camera-driven gesture control start/stop, independent of the always-on InputManager wiring. */
export function useGestureControls(): { enable: () => Promise<void>; disable: () => Promise<void> } {
  const ctx = useContext(InputManagerContext);
  if (!ctx) {
    throw new Error('useGestureControls must be used within InputManagerProvider');
  }
  return { enable: ctx.enableGestures, disable: ctx.disableGestures };
}

/** Ref set by the Viewer stage so zoom math knows the rendered image size. */
export const stageMetricsRef = {
  containerSize: { width: 0, height: 0 },
  contentSize: { width: 0, height: 0 },
};

interface InputManagerProviderProps {
  children: ReactNode;
}

export function InputManagerProvider({ children }: InputManagerProviderProps) {
  const manager = useMemo(() => new InputManager(), []);
  const mouseKeyboardSourceRef = useRef(new MouseKeyboardSource());
  const gestureControllerRef = useRef(
    new MediaPipeGestureController({
      onStatusChange: (status, error) => {
        useViewerStore.getState().setGestureStatus(status, error);
      },
      onLockStateChange: (state, progress) => {
        useViewerStore.getState().setGestureLock(state, progress);
      },
      onModeChange: (mode) => {
        useViewerStore.getState().setGestureMode(mode);
      },
      onHandFrame: (update) => {
        latestHandFrameRef.current = update;
      },
    }),
  );

  useEffect(() => {
    const unregisterMouse = manager.registerSource(mouseKeyboardSourceRef.current);
    const unregisterGesture = manager.registerSource(gestureControllerRef.current);

    const unsubscribe = manager.subscribe((action) => {
      const store = useViewerStore.getState();

      switch (action.type) {
        case 'NEXT':
          store.next();
          break;
        case 'PREVIOUS':
          store.previous();
          break;
        case 'SELECT':
          store.select(action.index);
          break;
        case 'ZOOM': {
          const nextScale = clamp(
            store.zoomPan.scale * (1 + action.delta),
            MIN_SCALE,
            MAX_SCALE,
          );
          store.setZoomPan({ scale: nextScale });
          break;
        }
        case 'TOGGLE_ZOOM': {
          const { contentSize, containerSize } = stageMetricsRef;
          const actualScale = computeActualScale(contentSize, containerSize);
          const isZoomedIn = store.viewMode === 'actual' || store.zoomPan.scale > 1.01;
          if (isZoomedIn) {
            store.fitToScreen();
          } else {
            store.setZoomPan({ scale: actualScale });
            store.actualSize();
          }
          break;
        }
        case 'PAN':
          store.setZoomPan({
            x: store.zoomPan.x + action.dx,
            y: store.zoomPan.y + action.dy,
          });
          break;
        case 'FIT':
          store.fitToScreen();
          break;
        case 'ACTUAL_SIZE': {
          const scale = computeActualScale(stageMetricsRef.contentSize, stageMetricsRef.containerSize);
          store.setZoomPan({ scale, x: 0, y: 0 });
          store.actualSize();
          break;
        }
        case 'TOGGLE_UI':
          store.toggleUI();
          break;
        case 'TOGGLE_SLIDESHOW':
          store.toggleSlideshow();
          break;
        case 'START_SLIDESHOW':
          store.startSlideshow();
          break;
        case 'STOP_SLIDESHOW':
          store.stopSlideshow();
          break;
        case 'EXIT':
          store.stopSlideshow();
          store.fitToScreen();
          break;
        case 'CURSOR':
          store.setCursorPosition(action.position);
          store.showUI();
          break;
      }
    });

    return () => {
      unsubscribe();
      unregisterMouse();
      unregisterGesture();
    };
  }, [manager]);

  const contextValue = useMemo<InputManagerContextValue>(
    () => ({
      manager,
      bindStageElement: (element) => {
        const source = mouseKeyboardSourceRef.current;
        source.unbindElement();
        if (element) {
          source.bindElement(element);
        }
      },
      enableGestures: () => gestureControllerRef.current.enable(),
      disableGestures: () => gestureControllerRef.current.disable(),
    }),
    [manager],
  );

  return (
    <InputManagerContext.Provider value={contextValue}>{children}</InputManagerContext.Provider>
  );
}
