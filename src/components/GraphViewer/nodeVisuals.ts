import * as THREE from 'three';
import type { PositionedNode } from '@/graph/types';

export const ACCENT = '#22d3ee';
const FOLDER_COLOR = '#38bdf8';
const PARENT_COLOR = '#7d8db0';
const FILE_FALLBACK = '#8b9bb8';

const LANGUAGE_COLORS: Record<string, string> = {
  ts: '#5b9dff',
  tsx: '#22d3ee',
  js: '#eab308',
  mjs: '#eab308',
  css: '#c084fc',
  json: '#f59e0b',
  md: '#9fb0ca',
  csv: '#4ade80',
  yml: '#fb923c',
  yaml: '#fb923c',
  svg: '#f472b6',
};

export function nodeColor(positioned: PositionedNode): string {
  if (positioned.role === 'parent') return PARENT_COLOR;
  if (positioned.node.kind === 'folder') return FOLDER_COLOR;
  return LANGUAGE_COLORS[positioned.node.language ?? ''] ?? FILE_FALLBACK;
}

/** World diameter of the disc per role. */
export function nodeScale(positioned: PositionedNode): number {
  switch (positioned.role) {
    case 'center':
      return 1.0;
    case 'parent':
      return 0.5;
    case 'child':
      return positioned.node.kind === 'folder' ? 0.62 : 0.46;
    case 'mini':
      return 0.14;
  }
}

/** Everything attached to one rendered node, kept for animation + disposal. */
export interface NodeVisual {
  key: string;
  nodeId: string;
  role: PositionedNode['role'];
  group: THREE.Group;
  disc: THREE.Sprite;
  hoverRing: THREE.Sprite | null;
  label: THREE.Sprite | null;
  targetPosition: THREE.Vector3;
  baseScale: number;
  /** Current animated emphasis 0..1 (hover/selection), eased in the render loop. */
  emphasis: number;
  spawnedAtMs: number;
}

// -- shared textures -----------------------------------------------------------

const textureCache = new Map<string, THREE.Texture>();

/** Crisp filled disc with a soft edge and optional outline ring. */
function discTexture(fill: string, ring: string | null): THREE.Texture {
  const key = `${fill}|${ring ?? ''}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 128;
  const c = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Subtle halo so discs feel lit without a separate glow sprite.
  const halo = ctx.createRadialGradient(c, c, size * 0.3, c, c, c);
  halo.addColorStop(0, `${fill}40`);
  halo.addColorStop(1, `${fill}00`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(c, c, size * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();

  // Inner shading for a slightly dimensional, polished look.
  const shade = ctx.createRadialGradient(c - 14, c - 14, 4, c, c, size * 0.34);
  shade.addColorStop(0, 'rgba(255,255,255,0.35)');
  shade.addColorStop(0.5, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.beginPath();
  ctx.arc(c, c, size * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = shade;
  ctx.fill();

  if (ring) {
    ctx.beginPath();
    ctx.arc(c, c, size * 0.42, 0, Math.PI * 2);
    ctx.strokeStyle = ring;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}

/** White targeting ring shown around the hovered node. */
function hoverRingTexture(): THREE.Texture {
  const key = 'hover-ring';
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 128;
  const c = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(c, c, size * 0.44, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 5;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  textureCache.set(key, texture);
  return texture;
}

function makeLabelSprite(positioned: PositionedNode): THREE.Sprite {
  const { node, role } = positioned;
  const isCenter = role === 'center';
  const isFolder = node.kind === 'folder';
  const text =
    role === 'parent'
      ? `← ${node.name}`
      : isFolder && node.children?.length
        ? `${node.name} · ${node.children.length}`
        : node.name;

  const font = isCenter
    ? '600 40px Inter, sans-serif'
    : isFolder
      ? '600 32px Inter, sans-serif'
      : '400 30px Inter, sans-serif';

  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  const textWidth = Math.ceil(measure.measureText(text).width);

  const padX = 22;
  const height = isCenter ? 60 : 50;
  const canvas = document.createElement('canvas');
  canvas.width = textWidth + padX * 2;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(7, 11, 18, 0.72)';
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, height, height / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isCenter ? '#f5f8ff' : isFolder ? '#bfeaf7' : '#c9d4e6';
  ctx.fillText(text, canvas.width / 2, height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const worldHeight = isCenter ? 0.34 : 0.26;
  sprite.scale.set((canvas.width / height) * worldHeight, worldHeight, 1);
  return sprite;
}

// -- build / dispose -----------------------------------------------------------

export function visualKey(positioned: PositionedNode): string {
  return positioned.role === 'mini' ? `mini:${positioned.node.id}` : positioned.node.id;
}

/** Build the sprites for one node: disc, optional hover ring, optional label. */
export function createNodeVisual(positioned: PositionedNode, nowMs: number): NodeVisual {
  const { role } = positioned;
  const color = nodeColor(positioned);
  const group = new THREE.Group();
  const baseScale = nodeScale(positioned);

  const ring = role === 'center' ? 'rgba(255,255,255,0.85)' : null;
  const disc = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: discTexture(color, ring),
      transparent: true,
      opacity: role === 'mini' ? 0.45 : 1,
      depthWrite: false,
    }),
  );
  group.add(disc);

  let hoverRing: THREE.Sprite | null = null;
  let label: THREE.Sprite | null = null;

  if (role !== 'mini') {
    hoverRing = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: hoverRingTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    hoverRing.scale.setScalar(1.35);
    group.add(hoverRing);

    label = makeLabelSprite(positioned);
    label.position.y = -(baseScale / 2 + 0.24);
    group.add(label);
  }

  group.position.set(...positioned.position);
  group.scale.setScalar(0.001);

  return {
    key: visualKey(positioned),
    nodeId: positioned.node.id,
    role,
    group,
    disc,
    hoverRing,
    label,
    targetPosition: new THREE.Vector3(...positioned.position),
    baseScale,
    emphasis: 0,
    spawnedAtMs: nowMs,
  };
}

export function disposeNodeVisual(visual: NodeVisual): void {
  visual.group.removeFromParent();
  // Disc + hover-ring textures are shared via cache; only dispose materials.
  visual.disc.material.dispose();
  visual.hoverRing?.material.dispose();
  if (visual.label) {
    visual.label.material.map?.dispose();
    visual.label.material.dispose();
  }
}
