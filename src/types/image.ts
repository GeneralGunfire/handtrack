export type TransitionType = 'fade' | 'slide' | 'dissolve';

export interface ImageItem {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
  width: number;
  height: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}
