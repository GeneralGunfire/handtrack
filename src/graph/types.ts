export type NodeKind = 'folder' | 'file';

/** One entry in the manual codebase tree. */
export interface TreeNode {
  id: string;
  name: string;
  kind: NodeKind;
  children?: TreeNode[];
  /** File extension-ish language tag, drives node color + preview highlighting. */
  language?: string;
  /** Approximate size in bytes, drives node scale. */
  size?: number;
  /** Short code/content excerpt shown in the preview panel. */
  preview?: string;
}

/** A node laid out in space, ready to render. */
export interface PositionedNode {
  node: TreeNode;
  depth: number;
  parentId: string | null;
  position: [number, number, number];
  /** Whether this folder's children are currently shown. */
  expanded: boolean;
}

export interface GraphEdge {
  fromId: string;
  toId: string;
}

export interface GraphLayout {
  nodes: PositionedNode[];
  edges: GraphEdge[];
  byId: Map<string, PositionedNode>;
}
