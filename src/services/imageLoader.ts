import type { ImageDimensions, ImageItem } from '@/types/image';
import { isAcceptedImageFile } from './fileTypes';

function readDimensions(url: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

async function toImageItem(file: File): Promise<ImageItem> {
  const url = URL.createObjectURL(file);
  const { width, height } = await readDimensions(url);

  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    url,
    name: file.name,
    size: file.size,
    width,
    height,
  };
}

/** Filters to supported image types and probes dimensions for each. */
export async function loadImageItems(files: File[]): Promise<ImageItem[]> {
  const accepted = files.filter(isAcceptedImageFile);
  const results = await Promise.allSettled(accepted.map(toImageItem));

  return results
    .filter((r): r is PromiseFulfilledResult<ImageItem> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/** Extracts files from a DataTransfer, including folder drops via webkitGetAsEntry. */
export async function extractFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items);
  const hasEntrySupport = items.some((item) => 'webkitGetAsEntry' in item);

  if (!hasEntrySupport) {
    return Array.from(dataTransfer.files);
  }

  const entries = items
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => entry !== null && entry !== undefined);

  if (entries.length === 0) {
    return Array.from(dataTransfer.files);
  }

  const files: File[] = [];
  await Promise.all(entries.map((entry) => walkEntry(entry, files)));
  return files;
}

function walkEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file((file) => {
        out.push(file);
        resolve();
      }, () => resolve());
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const readAll = () => {
        reader.readEntries(async (children) => {
          if (children.length === 0) {
            resolve();
            return;
          }
          await Promise.all(children.map((child) => walkEntry(child, out)));
          readAll();
        }, () => resolve());
      };
      readAll();
    } else {
      resolve();
    }
  });
}
