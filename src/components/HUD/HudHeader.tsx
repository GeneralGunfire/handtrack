import { useMemo } from 'react';
import { useGraphStore } from '@/store/graphStore';
import { countNodes, findPath } from '@/graph/nodeUtils';

/** Top-left HUD: system title, node counts, and a clickable breadcrumb trail
 *  from the root to the focused folder. */
export function HudHeader() {
  const tree = useGraphStore((state) => state.tree);
  const focusedId = useGraphStore((state) => state.focusedId);
  const focusNode = useGraphStore((state) => state.focusNode);

  const counts = useMemo(() => countNodes(tree), [tree]);
  const path = useMemo(() => findPath(tree, focusedId), [tree, focusedId]);

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
        <p className="pointer-events-auto mt-2 flex flex-wrap items-center gap-1 font-mono text-xs text-ink-1">
          {path.map((node, i) => {
            const isLast = i === path.length - 1;
            return (
              <span key={node.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-ink-2">/</span>}
                {isLast ? (
                  <span className="text-accent">{node.name}</span>
                ) : (
                  <button
                    onClick={() => focusNode(node.id)}
                    className="rounded px-0.5 transition-colors hover:bg-white/10 hover:text-ink-0"
                  >
                    {node.name}
                  </button>
                )}
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}
