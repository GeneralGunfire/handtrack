import { create } from 'zustand';
import type { ImageItem, TransitionType } from '@/types/image';
import type { Point } from '@/types/action';

export type ViewMode = 'fit' | 'actual' | 'custom';
export type NavDirection = 'forward' | 'backward';

interface ZoomPanState {
  scale: number;
  x: number;
  y: number;
}

interface ViewerState {
  images: ImageItem[];
  currentIndex: number;
  navDirection: NavDirection;

  zoomPan: ZoomPanState;
  viewMode: ViewMode;

  uiVisible: boolean;
  metadataVisible: boolean;

  isSlideshowActive: boolean;
  slideshowIntervalMs: number;

  transitionType: TransitionType;
  cursorPosition: Point;

  gestureStatus: 'idle' | 'loading' | 'active' | 'error';
  gestureError: string | null;
  gestureLockState: 'searching' | 'locking' | 'locked' | 'lost';
  gestureLockProgress: number;
  gestureMode: 'neutral' | 'zoom' | 'pan';

  addImages: (images: ImageItem[]) => void;
  removeImage: (id: string) => void;
  reorderImages: (fromIndex: number, toIndex: number) => void;

  next: () => void;
  previous: () => void;
  select: (index: number) => void;

  setZoomPan: (partial: Partial<ZoomPanState>) => void;
  resetZoomPan: () => void;
  fitToScreen: () => void;
  actualSize: () => void;

  toggleUI: () => void;
  showUI: () => void;

  startSlideshow: () => void;
  stopSlideshow: () => void;
  toggleSlideshow: () => void;

  setCursorPosition: (position: Point) => void;

  setGestureStatus: (status: 'idle' | 'loading' | 'active' | 'error', error?: string) => void;
  setGestureLock: (state: 'searching' | 'locking' | 'locked' | 'lost', progress: number) => void;
  setGestureMode: (mode: 'neutral' | 'zoom' | 'pan') => void;
}

const DEFAULT_ZOOM_PAN: ZoomPanState = { scale: 1, x: 0, y: 0 };

export const useViewerStore = create<ViewerState>((set) => ({
  images: [],
  currentIndex: 0,
  navDirection: 'forward',

  zoomPan: DEFAULT_ZOOM_PAN,
  viewMode: 'fit',

  uiVisible: true,
  metadataVisible: false,

  isSlideshowActive: false,
  slideshowIntervalMs: 4000,

  transitionType: 'fade',
  cursorPosition: { x: 0, y: 0 },

  gestureStatus: 'idle',
  gestureError: null,
  gestureLockState: 'searching',
  gestureLockProgress: 0,
  gestureMode: 'neutral',

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
        navDirection: 'forward',
        zoomPan: DEFAULT_ZOOM_PAN,
        viewMode: 'fit',
      };
    }),

  previous: () =>
    set((state) => {
      if (state.images.length === 0) return state;
      return {
        currentIndex: (state.currentIndex - 1 + state.images.length) % state.images.length,
        navDirection: 'backward',
        zoomPan: DEFAULT_ZOOM_PAN,
        viewMode: 'fit',
      };
    }),

  select: (index) =>
    set((state) => {
      if (index < 0 || index >= state.images.length) return state;
      return {
        currentIndex: index,
        navDirection: index >= state.currentIndex ? 'forward' : 'backward',
        zoomPan: DEFAULT_ZOOM_PAN,
        viewMode: 'fit',
      };
    }),

  setZoomPan: (partial) =>
    set((state) => ({
      zoomPan: { ...state.zoomPan, ...partial },
      viewMode: 'custom',
    })),

  resetZoomPan: () => set({ zoomPan: DEFAULT_ZOOM_PAN, viewMode: 'fit' }),

  fitToScreen: () => set({ zoomPan: DEFAULT_ZOOM_PAN, viewMode: 'fit' }),

  actualSize: () => set({ viewMode: 'actual' }),

  toggleUI: () => set((state) => ({ uiVisible: !state.uiVisible })),

  showUI: () => set({ uiVisible: true }),

  startSlideshow: () => set({ isSlideshowActive: true }),

  stopSlideshow: () => set({ isSlideshowActive: false }),

  toggleSlideshow: () => set((state) => ({ isSlideshowActive: !state.isSlideshowActive })),

  setCursorPosition: (position) => set({ cursorPosition: position }),

  setGestureStatus: (status, error) =>
    set({ gestureStatus: status, gestureError: error ?? null }),

  setGestureLock: (state, progress) =>
    set({ gestureLockState: state, gestureLockProgress: progress }),

  setGestureMode: (mode) => set({ gestureMode: mode }),
}));

export const getViewerState = () => useViewerStore.getState();
