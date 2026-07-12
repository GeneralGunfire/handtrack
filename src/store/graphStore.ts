import { create } from 'zustand';
import { clamp } from '@/utils/clamp';
import { computeLayout } from '@/graph/layout';
import { findPath } from '@/graph/nodeUtils';
import { MERIDIAN_TREE } from '@/graph/meridianTree';
import type { GraphLayout, TreeNode } from '@/graph/types';

export type GestureMode = 'idle' | 'orbit' | 'pan_zoom';
export type PointerSource = 'mouse' | 'hand';

/** Spherical orbit camera around a pannable focus point. The hub view is
 *  mostly flat: yaw/pitch are clamped to a gentle parallax range. */
export interface CameraState {
  yaw: number;
  pitch: number;
  distance: number;
  targetX: number;
  targetY: number;
  targetZ: number;
}

export const CAMERA_LIMITS = {
  minYaw: -0.55,
  maxYaw: 0.55,
  minPitch: -0.15,
  maxPitch: 0.75,
  minDistance: 3,
  maxDistance: 16,
  maxPan: 4,
};

export const DEFAULT_CAMERA: CameraState = {
  yaw: 0,
  pitch: 0.22,
  distance: 8.5,
  targetX: 0,
  targetY: 0,
  targetZ: 0,
};

/** Finger-count gesture shortcuts: hold N fingers up to fly to these nodes. */
export const BOOKMARKS: Record<number, { id: string; label: string }> = {
  2: { id: 'frontend/src/app/page.tsx', label: 'Homepage' },
  3: { id: 'pipeline/src/scrape-all.ts', label: 'Scraper entry' },
  4: { id: 'pipeline/src/registry.ts', label: 'Dataset registry' },
};

interface GraphState {
  tree: TreeNode;
  /** The folder currently at the center of the hub view. */
  focusedId: string;
  layout: GraphLayout;

  hoveredId: string | null;
  selectedId: string | null;
  /** File currently open in the preview panel. */
  previewNode: TreeNode | null;

  /** Targeting cursor in normalized 0..1 screen coordinates. */
  pointer: { x: number; y: number };
  pointerSource: PointerSource;
  /** True while a hand pinch is engaged — closes the on-screen reticle. */
  pointerPinching: boolean;

  camera: CameraState;

  searchQuery: string;
  matchedIds: Set<string>;

  uiVisible: boolean;

  gestureStatus: 'idle' | 'loading' | 'active' | 'error';
  gestureError: string | null;
  gestureHands: number;
  gestureMode: GestureMode;

  setHovered: (id: string | null) => void;
  /** Commit on a node: folders refocus the hub, files open a preview. */
  tapNode: (id: string) => void;
  /** Refocus the hub on a folder (or on a file's parent, previewing the file). */
  focusNode: (id: string) => void;
  /** Step back to the focused folder's parent. Returns false at the root. */
  goBack: () => boolean;
  closePreview: () => void;

  orbitBy: (dyaw: number, dpitch: number) => void;
  dollyBy: (delta: number) => void;
  panBy: (dx: number, dy: number) => void;
  resetCamera: () => void;

  setPointer: (x: number, y: number, source: PointerSource) => void;
  setPointerPinching: (pinching: boolean) => void;

  setSearch: (query: string) => void;

  toggleUI: () => void;
  showUI: () => void;

  exit: () => void;

  setGestureStatus: (status: 'idle' | 'loading' | 'active' | 'error', error?: string) => void;
  setGestureHands: (count: number) => void;
  setGestureMode: (mode: GestureMode) => void;
}

function collectMatches(root: TreeNode, query: string): Set<string> {
  const matches = new Set<string>();
  if (!query.trim()) return matches;
  const q = query.trim().toLowerCase();
  const walk = (node: TreeNode) => {
    if (node.name.toLowerCase().includes(q)) matches.add(node.id);
    node.children?.forEach(walk);
  };
  walk(root);
  return matches;
}

/** Recentering resets pan drift but preserves the user's zoom + tilt. */
function recenteredCamera(camera: CameraState): CameraState {
  return { ...camera, targetX: 0, targetY: 0, targetZ: 0 };
}

export const useGraphStore = create<GraphState>((set, get) => ({
  tree: MERIDIAN_TREE,
  focusedId: 'root',
  layout: computeLayout(MERIDIAN_TREE, 'root'),

  hoveredId: null,
  selectedId: null,
  previewNode: null,

  pointer: { x: 0.5, y: 0.5 },
  pointerSource: 'mouse',
  pointerPinching: false,

  camera: DEFAULT_CAMERA,

  searchQuery: '',
  matchedIds: new Set<string>(),

  uiVisible: true,

  gestureStatus: 'idle',
  gestureError: null,
  gestureHands: 0,
  gestureMode: 'idle',

  setHovered: (id) => {
    if (get().hoveredId !== id) set({ hoveredId: id });
  },

  tapNode: (id) => {
    const state = get();
    const positioned = state.layout.byId.get(id);
    if (!positioned) return;
    const { node } = positioned;

    if (node.kind === 'folder') {
      get().focusNode(node.id);
    } else {
      set({ selectedId: node.id, previewNode: node });
    }
  },

  focusNode: (id) => {
    const state = get();
    const path = findPath(state.tree, id);
    if (path.length === 0) return;
    const target = path[path.length - 1];

    if (target.kind === 'file') {
      // Focus the file's parent folder and open the file.
      const parent = path.length > 1 ? path[path.length - 2] : state.tree;
      set({
        focusedId: parent.id,
        layout: computeLayout(state.tree, parent.id),
        selectedId: target.id,
        previewNode: target,
        camera: recenteredCamera(state.camera),
      });
    } else {
      set({
        focusedId: target.id,
        layout: computeLayout(state.tree, target.id),
        selectedId: target.id,
        camera: recenteredCamera(state.camera),
      });
    }
  },

  goBack: () => {
    const state = get();
    const path = findPath(state.tree, state.focusedId);
    if (path.length <= 1) return false;
    get().focusNode(path[path.length - 2].id);
    return true;
  },

  closePreview: () => set({ previewNode: null }),

  orbitBy: (dyaw, dpitch) =>
    set((state) => ({
      camera: {
        ...state.camera,
        yaw: clamp(state.camera.yaw + dyaw, CAMERA_LIMITS.minYaw, CAMERA_LIMITS.maxYaw),
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

  setPointer: (x, y, source) =>
    set({ pointer: { x: clamp(x, 0, 1), y: clamp(y, 0, 1) }, pointerSource: source }),

  setPointerPinching: (pinching) => {
    if (get().pointerPinching !== pinching) set({ pointerPinching: pinching });
  },

  setSearch: (query) =>
    set((state) => ({ searchQuery: query, matchedIds: collectMatches(state.tree, query) })),

  toggleUI: () => set((state) => ({ uiVisible: !state.uiVisible })),

  showUI: () => set({ uiVisible: true }),

  exit: () => set({ previewNode: null, selectedId: null }),

  setGestureStatus: (status, error) =>
    set({ gestureStatus: status, gestureError: error ?? null }),

  setGestureHands: (count) => set({ gestureHands: count }),

  setGestureMode: (mode) => set({ gestureMode: mode }),
}));

export const getGraphState = () => useGraphStore.getState();
