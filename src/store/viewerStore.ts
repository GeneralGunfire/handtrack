import { create } from 'zustand';
import type { ImageItem, TransitionType } from '@/types/image';
import type { Point } from '@/types/action';
import { clamp } from '@/utils/clamp';

export type NavDirection = 'forward' | 'backward';
export type GestureMode = 'idle' | 'orbit' | 'pan_zoom';

/** Spherical orbit camera: yaw/pitch around a pannable target at a given distance. */
export interface CameraState {
  yaw: number;
  pitch: number;
  distance: number;
  targetX: number;
  targetY: number;
}

export const CAMERA_LIMITS = {
  minPitch: -1.35,
  maxPitch: 1.35,
  minDistance: 1.1,
  maxDistance: 9,
  maxPan: 2.5,
};

export const DEFAULT_CAMERA: CameraState = {
  yaw: 0,
  pitch: 0.12,
  distance: 3.4,
  targetX: 0,
  targetY: 0,
};

interface ViewerState {
  images: ImageItem[];
  currentIndex: number;
  navDirection: NavDirection;

  camera: CameraState;

  uiVisible: boolean;
  metadataVisible: boolean;

  isSlideshowActive: boolean;
  slideshowIntervalMs: number;

  transitionType: TransitionType;
  cursorPosition: Point;

  gestureStatus: 'idle' | 'loading' | 'active' | 'error';
  gestureError: string | null;
  /** Number of hands currently detected by the tracker. */
  gestureHands: number;
  gestureMode: GestureMode;

  addImages: (images: ImageItem[]) => void;
  removeImage: (id: string) => void;
  reorderImages: (fromIndex: number, toIndex: number) => void;

  next: () => void;
  previous: () => void;
  select: (index: number) => void;

  orbitBy: (dyaw: number, dpitch: number) => void;
  dollyBy: (delta: number) => void;
  panBy: (dx: number, dy: number) => void;
  resetCamera: () => void;

  toggleUI: () => void;
  showUI: () => void;

  startSlideshow: () => void;
  stopSlideshow: () => void;
  toggleSlideshow: () => void;

  setCursorPosition: (position: Point) => void;

  setGestureStatus: (status: 'idle' | 'loading' | 'active' | 'error', error?: string) => void;
  setGestureHands: (count: number) => void;
  setGestureMode: (mode: GestureMode) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  images: [],
  currentIndex: 0,
  navDirection: 'forward',

  camera: DEFAULT_CAMERA,

  uiVisible: true,
  metadataVisible: false,

  isSlideshowActive: false,
  slideshowIntervalMs: 4000,

  transitionType: 'fade',
  cursorPosition: { x: 0, y: 0 },

  gestureStatus: 'idle',
  gestureError: null,
  gestureHands: 0,
  gestureMode: 'idle',

  addImages: (images) =>
    set((state) => ({
      images: [...state.images, ...images],
      currentIndex: state.images.length === 0 ? 0 : state.currentIndex,
    })),

  removeImage: (id) =>
    set((state) => {
      const removedIndex = state.images.findIndex((img) => img.id === id);
      if (removedIndex === -1) return state;

      const images = state.images.filter((img) => img.id !== id);
      let currentIndex = state.currentIndex;

      if (removedIndex < currentIndex) {
        currentIndex -= 1;
      } else if (removedIndex === currentIndex) {
        currentIndex = Math.min(currentIndex, images.length - 1);
      }

      return { images, currentIndex: Math.max(0, currentIndex) };
    }),

  reorderImages: (fromIndex, toIndex) =>
    set((state) => {
      const images = [...state.images];
      const [moved] = images.splice(fromIndex, 1);
      images.splice(toIndex, 0, moved);

      let currentIndex = state.currentIndex;
      if (state.currentIndex === fromIndex) {
        currentIndex = toIndex;
      } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
        currentIndex -= 1;
      } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
        currentIndex += 1;
      }

      return { images, currentIndex };
    }),

  next: () =>
    set((state) => {
      if (state.images.length === 0) return state;
      return {
        currentIndex: (state.currentIndex + 1) % state.images.length,
        navDirection: 'forward' as const,
        camera: DEFAULT_CAMERA,
      };
    }),

  previous: () =>
    set((state) => {
      if (state.images.length === 0) return state;
      return {
        currentIndex: (state.currentIndex - 1 + state.images.length) % state.images.length,
        navDirection: 'backward' as const,
        camera: DEFAULT_CAMERA,
      };
    }),

  select: (index) =>
    set((state) => {
      if (index < 0 || index >= state.images.length) return state;
      return {
        currentIndex: index,
        navDirection: index >= state.currentIndex ? ('forward' as const) : ('backward' as const),
        camera: DEFAULT_CAMERA,
      };
    }),

  orbitBy: (dyaw, dpitch) =>
    set((state) => ({
      camera: {
        ...state.camera,
        yaw: state.camera.yaw + dyaw,
        pitch: clamp(state.camera.pitch + dpitch, CAMERA_LIMITS.minPitch, CAMERA_LIMITS.maxPitch),
      },
    })),

  dollyBy: (delta) =>
    set((state) => ({
      camera: {
        ...state.camera,
        distance: clamp(
          state.camera.distance / (1 + delta),
          CAMERA_LIMITS.minDistance,
          CAMERA_LIMITS.maxDistance,
        ),
      },
    })),

  panBy: (dx, dy) =>
    set((state) => ({
      camera: {
        ...state.camera,
        targetX: clamp(state.camera.targetX + dx, -CAMERA_LIMITS.maxPan, CAMERA_LIMITS.maxPan),
        targetY: clamp(state.camera.targetY + dy, -CAMERA_LIMITS.maxPan, CAMERA_LIMITS.maxPan),
      },
    })),

  resetCamera: () => set({ camera: DEFAULT_CAMERA }),

  toggleUI: () => set((state) => ({ uiVisible: !state.uiVisible })),

  showUI: () => set({ uiVisible: true }),

  startSlideshow: () => set({ isSlideshowActive: true }),

  stopSlideshow: () => set({ isSlideshowActive: false }),

  toggleSlideshow: () => set((state) => ({ isSlideshowActive: !state.isSlideshowActive })),

  setCursorPosition: (position) => set({ cursorPosition: position }),

  setGestureStatus: (status, error) =>
    set({ gestureStatus: status, gestureError: error ?? null }),

  setGestureHands: (count) => set({ gestureHands: count }),

  setGestureMode: (mode) => set({ gestureMode: mode }),
}));

export const getViewerState = () => useViewerStore.getState();
