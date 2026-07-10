export interface Size {
  width: number;
  height: number;
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;

/** Scale factor to fit `content` fully inside `container`, capped at 1x. */
export function computeFitScale(content: Size, container: Size): number {
  if (content.width === 0 || content.height === 0) return 1;
  const scale = Math.min(container.width / content.width, container.height / content.height);
  return Math.min(scale, 1);
}

/** Scale factor for 1:1 pixel rendering relative to the fit baseline. */
export function computeActualScale(content: Size, container: Size): number {
  const fitScale = computeFitScale(content, container);
  if (fitScale === 0) return 1;
  return 1 / fitScale;
}
