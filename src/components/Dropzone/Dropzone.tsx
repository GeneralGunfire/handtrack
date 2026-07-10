import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { extractFilesFromDataTransfer, loadImageItems } from '@/services/imageLoader';
import { useViewerStore } from '@/store/viewerStore';
import { EmptyState } from './EmptyState';

const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif';

interface DropzoneProps {
  children: ReactNode;
}

export function Dropzone({ children }: DropzoneProps) {
  const images = useViewerStore((state) => state.images);
  const addImages = useViewerStore((state) => state.addImages);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDepth = useRef(0);

  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const ingestFiles = useCallback(
    async (files: File[]) => {
      const items = await loadImageItems(files);
      if (items.length > 0) addImages(items);
    },
    [addImages],
  );

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDraggingOver(true);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDraggingOver(false);
      const files = await extractFilesFromDataTransfer(e.dataTransfer);
      await ingestFiles(files);
    },
    [ingestFiles],
  );

  const handleFileInputChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      await ingestFiles(files);
      e.target.value = '';
    },
    [ingestFiles],
  );

  return (
    <div
      className="relative h-full w-full"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={filesInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error non-standard but broadly supported attribute for folder uploads
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {images.length === 0 ? (
        <EmptyState
          isDraggingOver={isDraggingOver}
          onSelectFiles={() => filesInputRef.current?.click()}
          onSelectFolder={() => folderInputRef.current?.click()}
        />
      ) : (
        children
      )}

      <AnimatePresence>
        {isDraggingOver && images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-accent/60 bg-surface-0/70 backdrop-blur-sm"
          >
            <p className="text-lg font-medium text-accent">Drop to add images</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
