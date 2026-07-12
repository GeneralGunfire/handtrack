import { create } from 'zustand';
import { clamp } from '@/utils/clamp';
import { computeLayout } from '@/graph/layout';
import { findPath } from '@/graph/nodeUtils';
import { SAMPLE_TREE } from '@/graph/sampleTree';
import type { GraphLayout, TreeNode } from '@/graph/types';

export type GestureMode = 'idle' | 'orbit' | 'pan_zoom';
export type PointerSource = 'mouse' | 'hand';

/** Spherical orbit camera around a pannable 3D focus point. */
export interface CameraState {
  yaw: number;
  pitch: number;
  distance: number;
  targetX: number;
  targetY: number;
  targetZ: number;
}

export const CAMERA_LIMITS = {
  minPitch: -1.35,
  maxPitch: 1.35,
  minDistance: 1.6,
  maxDistance: 18,
  maxPan: 9,
};

export const DEFAULT_CAMERA: CameraState = {
  yaw: 0,
  pitch: 0.35,
  distance: 9.5,
  targetX: 0,
  targetY: 0,
  targetZ: -0.6,
};

const INITIAL_EXPANDED = new Set(['root', 'src']);

interface GraphState {
  tree: TreeNode;
  expandedIds: Set<string>;
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
  /** Commit on a node: folders expand/collapse, files open a preview. */
  tapNode: (id: string) => void;
  closePreview: () => void;

  orbitBy: (dyaw: number, dpitch: number) => void;
  dollyBy: (delta: number) => void;
  panBy: (dx: number, dy: number) => void;
  resetCamera: () => void;
  /** Fly the camera focus to a node and pull in close. */
  focusOn: (id: string) => void;
  /** Expand every ancestor folder of a node, then focus and select it. */
  revealNode: (id: string) => void;

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

export const useGraphStore = create<GraphState>((set, get) => ({
  tree: SAMPLE_TREE,
  expandedIds: INITIAL_EXPANDED,
  layout: computeLayout(SAMPLE_TREE, INITIAL_EXPANDED),

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
      const expandedIds = new Set(state.expandedIds);
      const willExpand = !expandedIds.has(id);
      if (willExpand) {
        expandedIds.add(id);
      } else {
        // Collapse the folder and everything beneath it.
        const removeSubtree = (n: TreeNode) => {
          expandedIds.delete(n.id);
          n.children?.forEach(removeSubtree);
        };
        removeSubtree(node);
      }
      set({
        expandedIds,
        layout: computeLayout(state.tree, expandedIds),
        selectedId: id,
      });
      if (willExpand) get().focusOn(id);
    } else {
      set({ selectedId: id, previewNode: node });
      get().focusOn(id);
    }
  },

  closePreview: () => set({ previewNode: null }),

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

  focusOn: (id) => {
    const positioned = get().layout.byId.get(id);
    if (!positioned) return;
    const [x, y, z] = positioned.position;
    set((state) => ({
      camera: {
        ...state.camera,
        targetX: x,
        targetY: y,
        targetZ: z,
        distance: Math.min(state.camera.distance, positioned.node.kind === 'folder' ? 6 : 4),
      },
    }));
  },

  revealNode: (id) => {
    const state = get();
    const path = findPath(state.tree, id);
    if (path.length === 0) return;

    const expandedIds = new Set(state.expandedIds);
    for (const ancestor of path) {
      if (ancestor.kind === 'folder' && ancestor.id !== id) expandedIds.add(ancestor.id);
    }
    const leaf = path[path.length - 1];
    set({
      expandedIds,
      layout: computeLayout(state.tree, expandedIds),
      selectedId: id,
      previewNode: leaf.kind === 'file' ? leaf : state.previewNode,
    });
    get().focusOn(id);
  },

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
