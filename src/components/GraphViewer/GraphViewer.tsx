import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGraphStore } from '@/store/graphStore';
import { useStageBinding } from '@/controllers/context';
import { createNodeVisual, disposeNodeVisual, visualKey } from './nodeVisuals';
import type { NodeVisual } from './nodeVisuals';

/** Targeting: the pointer snaps to the nearest node within this many pixels,
 *  so neither mouse nor a jittery hand needs pixel-perfect aim. */
const SNAP_RADIUS_PX = 56;

/**
 * The hub-and-spoke stage. Renders the focused folder at the center with its
 * children ringed around it, animates every refocus (surviving nodes glide to
 * their new positions, new spokes fly out of the center), and resolves the
 * store's pointer to the nearest on-screen node by projection — a forgiving
 * snap-target model instead of precise raycasts.
 */
export function GraphViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const bindStageElement = useStageBinding();

  useEffect(() => {
    bindStageElement(containerRef.current);
    return () => bindStageElement(null);
  }, [bindStageElement]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // -- scene scaffolding --

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05070c');
    scene.fog = new THREE.Fog('#05070c', 16, 40);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      80,
    );

    // Sprites are unlit; lights only matter if meshes are added later.
    scene.add(new THREE.AmbientLight('#ffffff', 1));

    // Starfield backdrop.
    const starCount = 700;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 20 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: '#4d5f80',
      size: 0.045,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
    });
    scene.add(new THREE.Points(starGeometry, starMaterial));

    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    // -- node + edge sync --

    const visuals = new Map<string, NodeVisual>();

    // Edge buffers: main spokes (bright) and mini threads (faint), repositioned
    // every frame so lines track the nodes' animated positions.
    let mainPairs: Array<[string, string]> = [];
    let miniPairs: Array<[string, string]> = [];
    const mainGeometry = new THREE.BufferGeometry();
    const miniGeometry = new THREE.BufferGeometry();
    let mainAttribute = new THREE.BufferAttribute(new Float32Array(0), 3);
    let miniAttribute = new THREE.BufferAttribute(new Float32Array(0), 3);
    const mainLines = new THREE.LineSegments(
      mainGeometry,
      new THREE.LineBasicMaterial({ color: '#2b6f85', transparent: true, opacity: 0.75 }),
    );
    const miniLines = new THREE.LineSegments(
      miniGeometry,
      new THREE.LineBasicMaterial({ color: '#1d3a52', transparent: true, opacity: 0.5 }),
    );
    graphGroup.add(mainLines);
    graphGroup.add(miniLines);

    const syncLayout = () => {
      const layout = useGraphStore.getState().layout;
      const nowMs = performance.now();
      const seen = new Set<string>();

      for (const positioned of layout.nodes) {
        const key = visualKey(positioned);
        seen.add(key);
        const existing = visuals.get(key);
        if (existing && existing.role === positioned.role) {
          existing.targetPosition.set(...positioned.position);
        } else {
          if (existing) {
            // Same node, new role (e.g. child -> center): rebuild its look but
            // keep continuity by spawning at its previous position.
            const from = existing.group.position.clone();
            disposeNodeVisual(existing);
            const visual = createNodeVisual(positioned, nowMs);
            visual.group.position.copy(from);
            visuals.set(key, visual);
            graphGroup.add(visual.group);
          } else {
            // Brand-new nodes fly out of the center.
            const visual = createNodeVisual(positioned, nowMs);
            visual.group.position.set(0, 0, 0);
            visuals.set(key, visual);
            graphGroup.add(visual.group);
          }
        }
      }

      for (const [key, visual] of visuals) {
        if (!seen.has(key)) {
          disposeNodeVisual(visual);
          visuals.delete(key);
        }
      }

      mainPairs = [];
      miniPairs = [];
      for (const edge of layout.edges) {
        if (edge.kind === 'main') {
          mainPairs.push([edge.fromId, edge.toId]);
        } else {
          miniPairs.push([edge.fromId, `mini:${edge.toId}`]);
        }
      }
      mainAttribute = new THREE.BufferAttribute(new Float32Array(mainPairs.length * 6), 3);
      miniAttribute = new THREE.BufferAttribute(new Float32Array(miniPairs.length * 6), 3);
      mainGeometry.setAttribute('position', mainAttribute);
      miniGeometry.setAttribute('position', miniAttribute);
    };

    syncLayout();
    const unsubscribeLayout = useGraphStore.subscribe((state, prev) => {
      if (state.layout !== prev.layout) syncLayout();
    });

    // -- per-frame animation --

    const chase = { ...useGraphStore.getState().camera };
    const projected = new THREE.Vector3();
    let rafId = 0;
    let running = true;
    let lastTimeMs = 0;

    const renderLoop = (timeMs: number) => {
      if (!running) return;
      const store = useGraphStore.getState();
      const dt = lastTimeMs ? Math.min((timeMs - lastTimeMs) / 1000, 0.1) : 1 / 60;
      lastTimeMs = timeMs;

      // Camera chase (frame-rate-independent exponential smoothing).
      const k = 1 - Math.exp(-dt * 12);
      const target = store.camera;
      chase.yaw += (target.yaw - chase.yaw) * k;
      chase.pitch += (target.pitch - chase.pitch) * k;
      chase.distance += (target.distance - chase.distance) * k;
      chase.targetX += (target.targetX - chase.targetX) * k;
      chase.targetY += (target.targetY - chase.targetY) * k;
      chase.targetZ += (target.targetZ - chase.targetZ) * k;

      const cp = Math.cos(chase.pitch);
      camera.position.set(
        chase.targetX + chase.distance * cp * Math.sin(chase.yaw),
        chase.targetY + chase.distance * Math.sin(chase.pitch),
        chase.targetZ + chase.distance * cp * Math.cos(chase.yaw),
      );
      camera.lookAt(chase.targetX, chase.targetY, chase.targetZ);

      // Snap targeting: project every interactive node to screen space and
      // hover the nearest one within SNAP_RADIUS_PX of the pointer.
      const w = container.clientWidth;
      const h = container.clientHeight;
      const px = store.pointer.x * w;
      const py = store.pointer.y * h;
      let hoveredId: string | null = null;
      let bestDist = SNAP_RADIUS_PX;
      for (const visual of visuals.values()) {
        if (visual.role === 'mini') continue;
        projected.copy(visual.group.position).project(camera);
        if (projected.z > 1) continue; // behind the camera
        const sx = (projected.x + 1) * 0.5 * w;
        const sy = (1 - projected.y) * 0.5 * h;
        const d = Math.hypot(sx - px, sy - py);
        if (d < bestDist) {
          bestDist = d;
          hoveredId = visual.nodeId;
        }
      }
      store.setHovered(hoveredId);

      // Node animation: position lerp, spawn scale-in, emphasis easing.
      const nowMs = performance.now();
      const posK = 1 - Math.exp(-dt * 9);
      for (const visual of visuals.values()) {
        visual.group.position.lerp(visual.targetPosition, posK);

        const spawn = Math.min((nowMs - visual.spawnedAtMs) / 400, 1);
        const spawnEase = 1 - Math.pow(1 - spawn, 3);

        const isHovered = visual.role !== 'mini' && visual.nodeId === store.hoveredId;
        const isSelected = visual.nodeId === store.selectedId && visual.role !== 'mini';
        const isMatched = store.matchedIds.has(visual.nodeId) && visual.role !== 'mini';
        const targetEmphasis = isHovered ? 1 : isSelected ? 0.7 : isMatched ? 0.45 : 0;
        visual.emphasis += (targetEmphasis - visual.emphasis) * Math.min(dt * 12, 1);

        visual.group.scale.setScalar(visual.baseScale * spawnEase * (1 + visual.emphasis * 0.22));

        if (visual.hoverRing) {
          visual.hoverRing.material.opacity = visual.emphasis * 0.95;
          // Pinch feedback: the targeting ring tightens onto the node.
          const gripped = store.pointerPinching && isHovered;
          visual.hoverRing.scale.setScalar(gripped ? 1.12 : 1.35);
        }
      }

      // Edges follow the animated node positions.
      updateEdges(mainPairs, mainAttribute, visuals);
      updateEdges(miniPairs, miniAttribute, visuals);
      mainAttribute.needsUpdate = true;
      miniAttribute.needsUpdate = true;
      mainGeometry.computeBoundingSphere();
      miniGeometry.computeBoundingSphere();

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

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      unsubscribeLayout();
      resizeObserver.disconnect();
      for (const visual of visuals.values()) disposeNodeVisual(visual);
      visuals.clear();
      starGeometry.dispose();
      starMaterial.dispose();
      mainGeometry.dispose();
      miniGeometry.dispose();
      (mainLines.material as THREE.Material).dispose();
      (miniLines.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden"
      style={{ cursor: 'crosshair' }}
    />
  );
}

function updateEdges(
  pairs: Array<[string, string]>,
  attribute: THREE.BufferAttribute,
  visuals: Map<string, NodeVisual>,
): void {
  for (let i = 0; i < pairs.length; i++) {
    const from = visuals.get(pairs[i][0]);
    const to = visuals.get(pairs[i][1]);
    if (!from || !to) continue;
    attribute.setXYZ(i * 2, from.group.position.x, from.group.position.y, from.group.position.z);
    attribute.setXYZ(i * 2 + 1, to.group.position.x, to.group.position.y, to.group.position.z);
  }
}
