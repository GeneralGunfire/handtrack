import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { InputManager } from './InputManager';
import { MouseKeyboardSource } from './sources/MouseKeyboardSource';
import { MediaPipeGestureController } from './sources/MediaPipeGestureController';
import type { HandFrameUpdate } from './sources/MediaPipeGestureController';
import { BOOKMARKS, useGraphStore } from '@/store/graphStore';

/** Latest webcam frame + hand landmarks, updated outside React state so the
 *  hand preview panel can read it in its own rAF loop without causing
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

interface InputManagerProviderProps {
  children: ReactNode;
}

export function InputManagerProvider({ children }: InputManagerProviderProps) {
  const manager = useMemo(() => new InputManager(), []);
  const mouseKeyboardSourceRef = useRef(new MouseKeyboardSource());
  const gestureControllerRef = useRef(
    new MediaPipeGestureController({
      onStatusChange: (status, error) => {
        useGraphStore.getState().setGestureStatus(status, error);
      },
      onModeChange: (mode) => {
        useGraphStore.getState().setGestureMode(mode);
      },
      onHandCountChange: (count) => {
        useGraphStore.getState().setGestureHands(count);
      },
      onPinchChange: (pinching) => {
        useGraphStore.getState().setPointerPinching(pinching);
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
      const store = useGraphStore.getState();

      switch (action.type) {
        case 'ORBIT':
          store.orbitBy(action.dyaw, action.dpitch);
          break;
        case 'ZOOM':
          store.dollyBy(action.delta);
          break;
        case 'PAN': {
          // PAN deltas arrive as fractions of the view; scale by camera
          // distance so a hand/mouse movement covers the same screen-space
          // amount regardless of zoom level.
          const worldPerView = store.camera.distance * 0.9;
          store.panBy(-action.dx * worldPerView, action.dy * worldPerView);
          break;
        }
        case 'AIM':
          store.setPointer(action.x, action.y, action.source);
          store.showUI();
          break;
        case 'TAP': {
          const hovered = store.hoveredId;
          if (hovered) store.tapNode(hovered);
          break;
        }
        case 'FIT':
          store.resetCamera();
          break;
        case 'BOOKMARK': {
          const bookmark = BOOKMARKS[action.slot];
          if (bookmark) store.revealNode(bookmark.id);
          break;
        }
        case 'TOGGLE_UI':
          store.toggleUI();
          break;
        case 'EXIT':
          store.exit();
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
