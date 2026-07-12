import type { TreeNode } from './types';

/** Root-to-node path, inclusive. Empty array if the id isn't in the tree. */
export function findPath(root: TreeNode, id: string): TreeNode[] {
  const path: TreeNode[] = [];
  const walk = (node: TreeNode): boolean => {
    path.push(node);
    if (node.id === id) return true;
    for (const child of node.children ?? []) {
      if (walk(child)) return true;
    }
    path.pop();
    return false;
  };
  return walk(root) ? path : [];
}

export function countNodes(root: TreeNode): { files: number; folders: number } {
  let files = 0;
  let folders = 0;
  const walk = (node: TreeNode) => {
    if (node.kind === 'folder') {
      folders += 1;
      node.children?.forEach(walk);
    } else {
      files += 1;
    }
  };
  walk(root);
  return { files, folders };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
