export type NodeKind = 'folder' | 'file';

/** One entry in the codebase tree. */
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

/** Visual/interaction role in the hub-and-spoke view. */
export type NodeRole =
  /** The folder currently in focus, pinned at the origin. */
  | 'center'
  /** The focused folder's parent — the "back" spoke. */
  | 'parent'
  /** Direct child of the focused folder. */
  | 'child'
  /** Tiny non-interactive preview dot: a grandchild hugging its folder spoke. */
  | 'mini';

/** A node laid out in space, ready to render. */
export interface PositionedNode {
  node: TreeNode;
  role: NodeRole;
  /** For 'mini' dots: the id of the child spoke they belong to. */
  anchorId: string | null;
  position: [number, number, number];
}

export interface GraphEdge {
  fromId: string;
  toId: string;
  /** Mini edges are the faint threads from a folder spoke to its preview dots. */
  kind: 'main' | 'mini';
}

export interface GraphLayout {
  focusedId: string;
  nodes: PositionedNode[];
  edges: GraphEdge[];
  byId: Map<string, PositionedNode>;
}
