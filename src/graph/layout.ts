import type { GraphEdge, GraphLayout, PositionedNode, TreeNode } from './types';
import { findPath } from './nodeUtils';

/*
 * Hub-and-spoke focus layout: the focused folder sits at the origin, its
 * parent floats up-left as a "back" spoke, and its children ring around it —
 * folders first, then files, evenly spaced. Each folder spoke carries a small
 * cluster of faded mini-dots (its own children) behind it, so you can see at
 * a glance which branches have content without rendering the whole tree.
 * One level of real, interactive nodes at a time — never the whole graph.
 */

/** Ring radius grows with child count so spokes always have breathing room. */
const MIN_RING_RADIUS = 2.6;
const SPOKE_ARC_SPACING = 1.15;
/** Where the parent "back" spoke sits (radians; up-left). */
const PARENT_ANGLE = (3 * Math.PI) / 4;
const PARENT_RADIUS = 3.4;
/** Mini-dot cluster: how many grandchildren to preview per folder spoke. */
const MAX_MINI_DOTS = 8;
const MINI_RADIUS = 0.62;

export function computeLayout(root: TreeNode, focusedId: string): GraphLayout {
  const path = findPath(root, focusedId);
  const focused = path.length > 0 ? path[path.length - 1] : root;
  const parent = path.length > 1 ? path[path.length - 2] : null;

  const nodes: PositionedNode[] = [];
  const edges: GraphEdge[] = [];
  const byId = new Map<string, PositionedNode>();

  const add = (positioned: PositionedNode) => {
    nodes.push(positioned);
    if (positioned.role !== 'mini') byId.set(positioned.node.id, positioned);
  };

  add({ node: focused, role: 'center', anchorId: null, position: [0, 0, 0] });

  if (parent) {
    add({
      node: parent,
      role: 'parent',
      anchorId: null,
      position: [
        Math.cos(PARENT_ANGLE) * PARENT_RADIUS,
        Math.sin(PARENT_ANGLE) * PARENT_RADIUS,
        -0.3,
      ],
    });
    edges.push({ fromId: focused.id, toId: parent.id, kind: 'main' });
  }

  // Children ring: folders first, then files, clockwise from the top.
  const children = [...(focused.children ?? [])].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const count = children.length;
  if (count === 0) return { focusedId: focused.id, nodes, edges, byId };

  const radius = Math.max(MIN_RING_RADIUS, (count * SPOKE_ARC_SPACING) / (Math.PI * 2));

  children.forEach((child, i) => {
    // Start at the top and sweep clockwise around the ring.
    const t = i / count;
    const angle = Math.PI / 2 - t * Math.PI * 2;
    const jitter = hash01(child.id);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = (jitter - 0.5) * 0.24;

    add({ node: child, role: 'child', anchorId: null, position: [x, y, z] });
    edges.push({ fromId: focused.id, toId: child.id, kind: 'main' });

    // Preview cluster behind folder spokes.
    if (child.kind === 'folder' && child.children?.length) {
      const minis = child.children.slice(0, MAX_MINI_DOTS);
      const away = Math.atan2(y, x); // outward direction from the center
      minis.forEach((grandchild, j) => {
        const spread = (j / Math.max(minis.length - 1, 1) - 0.5) * (Math.PI * 0.9);
        const mx = x + Math.cos(away + spread) * MINI_RADIUS;
        const my = y + Math.sin(away + spread) * MINI_RADIUS;
        add({
          node: grandchild,
          role: 'mini',
          anchorId: child.id,
          position: [mx, my, z - 0.15],
        });
        edges.push({ fromId: child.id, toId: grandchild.id, kind: 'mini' });
      });
    }
  });

  return { focusedId: focused.id, nodes, edges, byId };
}

/** Deterministic 0..1 hash from a string, for stable per-node jitter. */
function hash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}
