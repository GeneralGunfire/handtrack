import { motion } from 'framer-motion';

interface EmptyStateProps {
  onSelectFiles: () => void;
  onSelectFolder: () => void;
  isDraggingOver: boolean;
}

export function EmptyState({ onSelectFiles, onSelectFolder, isDraggingOver }: EmptyStateProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6 text-center">
      <motion.div
        animate={{ scale: isDraggingOver ? 1.05 : 1, opacity: isDraggingOver ? 1 : 0.9 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex flex-col items-center gap-6"
      >
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-2xl border transition-colors duration-300 ${
            isDraggingOver
              ? 'border-accent/60 bg-accent/10'
              : 'border-white/10 bg-surface-2/50'
          }`}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            className={isDraggingOver ? 'text-accent' : 'text-ink-1'}
          >
            <path
              d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5M7 9l5-5 5 5M12 4v13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-medium text-ink-0">Drop images to begin</h1>
          <p className="max-w-sm text-sm text-ink-1">
            JPG, PNG, WEBP and GIF are supported. Drag files or a folder anywhere on this page.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onSelectFiles}
            className="rounded-full bg-accent/90 px-5 py-2.5 text-sm font-medium text-surface-0 transition-colors hover:bg-accent"
          >
            Choose files
          </button>
          <button
            onClick={onSelectFolder}
            className="rounded-full border border-white/10 bg-surface-2/60 px-5 py-2.5 text-sm font-medium text-ink-0 transition-colors hover:bg-surface-3"
          >
            Choose folder
          </button>
        </div>
      </motion.div>
    </div>
  );
}
