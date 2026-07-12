import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useViewerStore } from '@/store/viewerStore';
import { useStageBinding } from '@/controllers/context';
import type { ImageItem } from '@/types/image';

/** World size of the relief's longest edge. */
const RELIEF_SIZE = 2.4;
/** How far the brightest pixels rise off the slab. */
const RELIEF_DEPTH = 0.34;
/** Heightmap sampling resolution along the longest edge. */
const HEIGHTMAP_RES = 176;

/**
 * The 3D viewer. Each dropped image becomes a sculpted relief: the picture is
 * textured onto a dense plane whose vertices are displaced by pixel
 * brightness, mounted on a dark slab and lit with colored rim lights inside a
 * starfield. The orbit camera chases the store's camera state with critically
 * damped smoothing, so both mouse and hand input feel fluid.
 */
export function ObjectStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const bindStageElement = useStageBinding();
  const currentImage = useViewerStore((state) => state.images[state.currentIndex]);
  const imageId = currentImage?.id;
  const hasImage = Boolean(currentImage);

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    objectGroup: THREE.Group;
    dispose: () => void;
  } | null>(null);

  useEffect(() => {
    bindStageElement(containerRef.current);
    return () => bindStageElement(null);
  }, [bindStageElement, hasImage]);

  // Build renderer + scene whenever the stage container exists (it mounts
  // once the first image is added, and unmounts when all images are removed).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasImage) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07080d');
    scene.fog = new THREE.Fog('#07080d', 8, 22);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      60,
    );

    scene.add(new THREE.AmbientLight('#8899bb', 0.55));

    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(2.5, 3.5, 4);
    scene.add(key);

    const rimCyan = new THREE.PointLight('#22d3ee', 18, 30);
    rimCyan.position.set(-4, 1.5, -3);
    scene.add(rimCyan);

    const rimMagenta = new THREE.PointLight('#f472b6', 14, 30);
    rimMagenta.position.set(4, -2, -3.5);
    scene.add(rimMagenta);

    // Starfield backdrop.
    const starCount = 700;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 10 + Math.random() * 9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: '#6b7a99',
      size: 0.035,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
    });
    scene.add(new THREE.Points(starGeometry, starMaterial));

    const objectGroup = new THREE.Group();
    scene.add(objectGroup);

    // Camera chase state: eases toward the store's camera every frame.
    const chase = { ...useViewerStore.getState().camera };
    let rafId = 0;
    let running = true;
    let lastTimeMs = 0;

    const renderLoop = (timeMs: number) => {
      if (!running) return;
      const target = useViewerStore.getState().camera;

      // Frame-rate-independent exponential smoothing (~settles in ~120ms).
      const dt = lastTimeMs ? Math.min((timeMs - lastTimeMs) / 1000, 0.1) : 1 / 60;
      lastTimeMs = timeMs;
      const k = 1 - Math.exp(-dt * 14);
      chase.yaw += (target.yaw - chase.yaw) * k;
      chase.pitch += (target.pitch - chase.pitch) * k;
      chase.distance += (target.distance - chase.distance) * k;
      chase.targetX += (target.targetX - chase.targetX) * k;
      chase.targetY += (target.targetY - chase.targetY) * k;

      const cp = Math.cos(chase.pitch);
      camera.position.set(
        chase.targetX + chase.distance * cp * Math.sin(chase.yaw),
        chase.targetY + chase.distance * Math.sin(chase.pitch),
        chase.distance * cp * Math.cos(chase.yaw),
      );
      camera.lookAt(chase.targetX, chase.targetY, 0);

      // Gentle idle float + sway so the object always feels alive.
      const t = timeMs / 1000;
      objectGroup.position.y = Math.sin(t * 0.8) * 0.025;
      objectGroup.rotation.y = Math.sin(t * 0.35) * 0.02;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(renderLoop);
    };
    rafId = requestAnimationFrame(renderLoop);

    const onResize = () => {
      const w = container.clientWidth;
      const h = Math.max(container.clientHeight, 1);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    const dispose = () => {
      running = false;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      disposeGroup(objectGroup);
      starGeometry.dispose();
      starMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };

    sceneRef.current = { renderer, scene, camera, objectGroup, dispose };
    return () => {
      sceneRef.current = null;
      dispose();
    };
  }, [hasImage]);

  // Rebuild the relief whenever the current image changes.
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx || !currentImage) return;
    let cancelled = false;

    void buildRelief(currentImage).then((relief) => {
      if (!ctx.objectGroup) return;
      if (cancelled) {
        disposeGroup(relief);
        return;
      }
      disposeGroup(ctx.objectGroup);
      ctx.objectGroup.add(relief);

      // Scale-in entrance.
      relief.scale.setScalar(0.8);
      const start = performance.now();
      const grow = () => {
        const p = Math.min((performance.now() - start) / 450, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        relief.scale.setScalar(0.8 + 0.2 * eased);
        if (p < 1 && !cancelled) requestAnimationFrame(grow);
      };
      grow();
    });

    return () => {
      cancelled = true;
    };
  }, [imageId, currentImage]);

  if (!currentImage) return null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden"
      style={{ cursor: 'grab' }}
    />
  );
}

/** Dispose every geometry/material/texture inside a group and empty it. */
function disposeGroup(group: THREE.Group | THREE.Object3D): void {
  const doomed = [...group.children];
  for (const child of doomed) {
    child.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.map?.dispose();
          }
          material.dispose();
        }
      }
    });
    group.remove(child);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Turn an image into a 3D relief group: a displacement-sculpted textured
 * plane (brightness = height) mounted on a dark glossy slab.
 */
async function buildRelief(item: ImageItem): Promise<THREE.Group> {
  const img = await loadImage(item.url);

  const aspect = img.naturalWidth / Math.max(img.naturalHeight, 1);
  const worldW = aspect >= 1 ? RELIEF_SIZE : RELIEF_SIZE * aspect;
  const worldH = aspect >= 1 ? RELIEF_SIZE / aspect : RELIEF_SIZE;

  // Sample luminance at heightmap resolution.
  const resX = aspect >= 1 ? HEIGHTMAP_RES : Math.max(Math.round(HEIGHTMAP_RES * aspect), 16);
  const resY = aspect >= 1 ? Math.max(Math.round(HEIGHTMAP_RES / aspect), 16) : HEIGHTMAP_RES;
  const canvas = document.createElement('canvas');
  canvas.width = resX;
  canvas.height = resY;
  const ctx2d = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx2d.drawImage(img, 0, 0, resX, resY);
  const pixels = ctx2d.getImageData(0, 0, resX, resY).data;

  const geometry = new THREE.PlaneGeometry(worldW, worldH, resX - 1, resY - 1);
  const positions = geometry.attributes.position as THREE.BufferAttribute;

  for (let y = 0; y < resY; y++) {
    for (let x = 0; x < resX; x++) {
      const i = (y * resX + x) * 4;
      const lum = (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255;
      // Pin edges down so the relief reads as carved into the slab.
      const fx = Math.min(x / resX, 1 - x / resX) * resX;
      const fy = Math.min(y / resY, 1 - y / resY) * resY;
      const falloff = Math.min(Math.min(fx, fy) / 6, 1);
      positions.setZ(y * resX + x, lum * RELIEF_DEPTH * falloff);
    }
  }
  geometry.computeVertexNormals();

  const texture = new THREE.Texture(img);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const reliefMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.6,
    metalness: 0.08,
  });
  const relief = new THREE.Mesh(geometry, reliefMaterial);

  const slabDepth = 0.12;
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(worldW + 0.16, worldH + 0.16, slabDepth),
    new THREE.MeshStandardMaterial({ color: '#141824', roughness: 0.3, metalness: 0.7 }),
  );
  slab.position.z = -slabDepth / 2 - 0.001;

  const group = new THREE.Group();
  group.add(slab);
  group.add(relief);
  return group;
}
