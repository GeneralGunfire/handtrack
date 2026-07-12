import { AnimatePresence, motion } from 'framer-motion';
import { useGraphStore } from '@/store/graphStore';
import { findPath, formatBytes } from '@/graph/nodeUtils';

/** Right-side panel with metadata + code preview for the opened file. */
export function NodeDetailsPanel() {
  const previewNode = useGraphStore((state) => state.previewNode);
  const tree = useGraphStore((state) => state.tree);
  const closePreview = useGraphStore((state) => state.closePreview);

  const path = previewNode
    ? findPath(tree, previewNode.id)
        .map((n) => n.name)
        .join('/')
    : '';

  return (
    <AnimatePresence>
      {previewNode && (
        <motion.aside
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="glass absolute bottom-5 right-5 top-5 z-30 flex w-[26rem] max-w-[calc(100vw-2.5rem)] flex-col rounded-2xl shadow-glass"
        >
          <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate font-mono text-sm font-semibold text-accent">
                {previewNode.name}
              </h2>
              <p className="mt-0.5 truncate font-mono text-[11px] text-ink-2">{path}</p>
              <p className="mt-1 text-[11px] uppercase tracking-widest text-ink-1">
                {previewNode.language ?? 'file'}
                {previewNode.size !== undefined && ` · ${formatBytes(previewNode.size)}`}
              </p>
            </div>
            <button
              onClick={closePreview}
              aria-label="Close preview"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-1 transition-colors hover:bg-white/10 hover:text-ink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
            {previewNode.preview ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-ink-0/90">
                {previewNode.preview}
              </pre>
            ) : (
              <p className="text-xs text-ink-2">No preview available.</p>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
