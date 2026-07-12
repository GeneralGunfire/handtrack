import { useMemo } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { countNodes, findPath } from '@/graph/nodeUtils';

/** Top-left HUD: system title, node counts, and the selected node's path. */
export function HudHeader() {
  const tree = useGraphStore((state) => state.tree);
  const selectedId = useGraphStore((state) => state.selectedId);

  const counts = useMemo(() => countNodes(tree), [tree]);
  const path = useMemo(
    () => (selectedId ? findPath(tree, selectedId) : []),
    [tree, selectedId],
  );

  return (
    <div className="pointer-events-none absolute left-5 top-5 z-30 select-none">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-ink-0">
          Jarvis <span className="text-accent">·</span> Codebase Map
        </h1>
      </div>
      <p className="mt-1 text-[11px] uppercase tracking-widest text-ink-2">
        {counts.folders} folders · {counts.files} files
      </p>
      {path.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1 font-mono text-xs text-ink-1">
          {path.map((node, i) => (
            <span key={node.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-ink-2">/</span>}
              <span className={i === path.length - 1 ? 'text-accent' : ''}>{node.name}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
