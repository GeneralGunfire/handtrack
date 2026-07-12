import type { GraphEdge, GraphLayout, PositionedNode, TreeNode } from './types';

/** Radius of the first ring, and extra radius per depth level. */
const RING_BASE = 2.1;
const RING_STEP = 1.75;
/** Depth pushes nodes slightly back so the tree reads as a shallow 3D cone. */
const DEPTH_Z = -0.55;

/**
 * Radial wedge layout: the root sits at the origin and each expanded folder's
 * children fan out inside their parent's angular wedge on progressively larger
 * rings. Wedge widths are proportional to visible subtree size so dense
 * folders get more room. Deterministic per-node jitter breaks up the rings so
 * the result reads as a constellation rather than a diagram.
 */
export function computeLayout(root: TreeNode, expandedIds: ReadonlySet<string>): GraphLayout {
  const nodes: PositionedNode[] = [];
  const edges: GraphEdge[] = [];
  const byId = new Map<string, PositionedNode>();

  /** Visible descendant count — drives how much angular room a subtree gets. */
  const weight = (node: TreeNode): number => {
    if (node.kind !== 'folder' || !expandedIds.has(node.id) || !node.children?.length) {
      return 1;
    }
    return 1 + node.children.reduce((sum, child) => sum + weight(child), 0) * 0.85;
  };

  const place = (
    node: TreeNode,
    depth: number,
    parentId: string | null,
    angleStart: number,
    angleEnd: number,
  ): void => {
    const midAngle = (angleStart + angleEnd) / 2;
    const radius = depth === 0 ? 0 : RING_BASE + (depth - 1) * RING_STEP;
    const jitter = hash01(node.id);
    const r = radius * (1 + (jitter - 0.5) * 0.14);
    const expanded = node.kind === 'folder' && expandedIds.has(node.id);

    const positioned: PositionedNode = {
      node,
      depth,
      parentId,
      expanded,
      position: [
        Math.cos(midAngle) * r,
        Math.sin(midAngle) * r,
        depth * DEPTH_Z + (jitter - 0.5) * 0.5,
      ],
    };
    nodes.push(positioned);
    byId.set(node.id, positioned);
    if (parentId) {
      edges.push({ fromId: parentId, toId: node.id });
    }

    if (!expanded || !node.children?.length) return;

    const total = node.children.reduce((sum, child) => sum + weight(child), 0);
    // The root spreads over the full circle; nested folders stay inside a
    // slightly widened copy of their own wedge so subtrees don't collide.
    const span = depth === 0 ? Math.PI * 2 : Math.min((angleEnd - angleStart) * 1.35, Math.PI * 1.5);
    let cursor = midAngle - span / 2;
    for (const child of node.children) {
      const childSpan = (weight(child) / total) * span;
      place(child, depth + 1, node.id, cursor, cursor + childSpan);
      cursor += childSpan;
    }
  };

  place(root, 0, null, 0, Math.PI * 2);
  return { nodes, edges, byId };
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
