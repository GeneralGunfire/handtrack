import * as THREE from 'three';
import type { PositionedNode } from '@/graph/types';

export const ACCENT = '#22d3ee';

const LANGUAGE_COLORS: Record<string, string> = {
  ts: '#3b82f6',
  tsx: '#22d3ee',
  js: '#eab308',
  mjs: '#eab308',
  css: '#a855f7',
  json: '#f59e0b',
  md: '#94a3b8',
  csv: '#4ade80',
  yml: '#f97316',
  yaml: '#f97316',
  svg: '#ec4899',
};
const FILE_FALLBACK = '#64748b';

export function nodeColor(positioned: PositionedNode): string {
  if (positioned.node.kind === 'folder') return ACCENT;
  return LANGUAGE_COLORS[positioned.node.language ?? ''] ?? FILE_FALLBACK;
}

/** Everything attached to one rendered node, kept for animation + disposal. */
export interface NodeVisual {
  group: THREE.Group;
  core: THREE.Mesh;
  glow: THREE.Sprite;
  label: THREE.Sprite;
  hit: THREE.Mesh;
  targetPosition: THREE.Vector3;
  baseScale: number;
  /** Current animated emphasis 0..1 (hover/selection), eased in the render loop. */
  emphasis: number;
  spawnedAtMs: number;
}

let sharedGlowTexture: THREE.Texture | null = null;

/** Soft radial gradient used by every node's additive glow sprite. */
function glowTexture(): THREE.Texture {
  if (sharedGlowTexture) return sharedGlowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  sharedGlowTexture = new THREE.CanvasTexture(canvas);
  return sharedGlowTexture;
}

function makeLabelSprite(text: string, color: string, isFolder: boolean): THREE.Sprite {
  const font = isFolder ? '600 30px Inter, sans-serif' : '400 26px Inter, sans-serif';
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  const textWidth = Math.ceil(measure.measureText(text).width);

  const padX = 18;
  const height = 44;
  const canvas = document.createElement('canvas');
  canvas.width = textWidth + padX * 2;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(8, 12, 18, 0.55)';
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, height, 10);
  ctx.fill();

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const worldHeight = isFolder ? 0.24 : 0.2;
  sprite.scale.set((canvas.width / height) * worldHeight, worldHeight, 1);
  return sprite;
}

/** Build the meshes for one node: geometric core, additive glow halo,
 *  name label, and an oversized invisible hit sphere for forgiving raycasts. */
export function createNodeVisual(positioned: PositionedNode, nowMs: number): NodeVisual {
  const isFolder = positioned.node.kind === 'folder';
  const color = nodeColor(positioned);
  const group = new THREE.Group();

  const sizeBytes = positioned.node.size ?? 1500;
  const baseScale = isFolder
    ? positioned.depth === 0
      ? 1.5
      : 1.15
    : 0.7 + Math.min(sizeBytes / 6000, 1) * 0.35;

  const geometry = isFolder
    ? new THREE.OctahedronGeometry(0.22, 0)
    : new THREE.IcosahedronGeometry(0.13, 1);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: isFolder ? 0.7 : 0.45,
    roughness: 0.35,
    metalness: 0.2,
    transparent: true,
    opacity: isFolder ? 0.92 : 0.95,
  });
  const core = new THREE.Mesh(geometry, material);
  group.add(core);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity: isFolder ? 0.5 : 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.scale.setScalar(isFolder ? 1.1 : 0.7);
  group.add(glow);

  const childCount = positioned.node.children?.length ?? 0;
  const labelText = isFolder ? `${positioned.node.name} · ${childCount}` : positioned.node.name;
  const label = makeLabelSprite(labelText, isFolder ? ACCENT : '#c8d2e0', isFolder);
  label.position.y = isFolder ? -0.42 : -0.3;
  group.add(label);

  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.userData.nodeId = positioned.node.id;
  group.add(hit);

  group.position.set(...positioned.position);
  group.scale.setScalar(0.001);

  return {
    group,
    core,
    glow,
    label,
    hit,
    targetPosition: new THREE.Vector3(...positioned.position),
    baseScale,
    emphasis: 0,
    spawnedAtMs: nowMs,
  };
}

export function disposeNodeVisual(visual: NodeVisual): void {
  visual.group.removeFromParent();
  visual.core.geometry.dispose();
  (visual.core.material as THREE.Material).dispose();
  visual.glow.material.map = null; // shared texture — don't dispose it
  visual.glow.material.dispose();
  visual.label.material.map?.dispose();
  visual.label.material.dispose();
  visual.hit.geometry.dispose();
  (visual.hit.material as THREE.Material).dispose();
}
