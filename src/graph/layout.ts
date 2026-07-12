import type { GraphEdge, GraphLayout, PositionedNode, TreeNode } from './types';

/** Radius of the first ring, and minimum extra radius per depth level. */
const RING_BASE = 2.3;
const RING_STEP = 1.9;
/** Minimum arc distance between sibling nodes so labels never overlap. */
const MIN_SIBLING_SPACING = 0.85;
/** Depth pushes nodes slightly back so the tree reads as a shallow 3D cone. */
const DEPTH_Z = -0.5;

/**
 * Radial wedge layout: the root sits at the origin and each expanded folder's
 * children fan out inside their parent's angular wedge. Wedge widths are
 * proportional to visible subtree size so dense folders get more room, and
 * each ring's radius grows as needed so siblings always keep a minimum arc
 * spacing — a 20-file folder pushes its ring outward instead of clumping.
 * Deterministic per-node jitter keeps it reading as a constellation.
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
    radius: number,
  ): void => {
    const midAngle = (angleStart + angleEnd) / 2;
    const jitter = hash01(node.id);
    const r = radius * (1 + (jitter - 0.5) * 0.08);
    const expanded = node.kind === 'folder' && expandedIds.has(node.id);

    const positioned: PositionedNode = {
      node,
      depth,
      parentId,
      expanded,
      position: [
        Math.cos(midAngle) * r,
        Math.sin(midAngle) * r,
        depth * DEPTH_Z + (jitter - 0.5) * 0.4,
      ],
    };
    nodes.push(positioned);
    byId.set(node.id, positioned);
    if (parentId) {
      edges.push({ fromId: parentId, toId: node.id });
    }

    if (!expanded || !node.children?.length) return;

    const total = node.children.reduce((sum, child) => sum + weight(child), 0);
    // The root spreads over the full circle. Nested folders start from a
    // slightly widened copy of their own wedge, but a folder with many
    // children may claim a wider fan — angular overlap with siblings is fine
    // because their rings sit at different radii.
    const naturalSpan = Math.min((angleEnd - angleStart) * 1.4, Math.PI * 1.6);
    const span =
      depth === 0
        ? Math.PI * 2
        : Math.min(Math.max(naturalSpan, node.children.length * 0.3), Math.PI * 1.7);

    // Push the children's ring outward until every sibling has room. The
    // narrowest wedge goes to weight-1 leaves, so size the radius for them —
    // capped so a huge folder crowds slightly instead of flying off-screen.
    const leafWedge = (1 / total) * span;
    const requiredRadius = MIN_SIBLING_SPACING / Math.max(leafWedge, 1e-3);
    const childRadius = Math.max(
      radius + RING_STEP,
      depth === 0 ? RING_BASE : 0,
      Math.min(requiredRadius, radius + RING_STEP * 3),
    );

    let cursor = midAngle - span / 2;
    for (const child of node.children) {
      const childSpan = (weight(child) / total) * span;
      place(child, depth + 1, node.id, cursor, cursor + childSpan, childRadius);
      cursor += childSpan;
    }
  };

  place(root, 0, null, 0, Math.PI * 2, 0);
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
