import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGraphStore } from '@/store/graphStore';
import { useStageBinding } from '@/controllers/context';
import { createNodeVisual, disposeNodeVisual } from './nodeVisuals';
import type { NodeVisual } from './nodeVisuals';

/**
 * The 3D stage: renders the laid-out file tree as a holographic node
 * constellation. Owns the Three.js scene, a raycaster that resolves the
 * store's pointer into a hovered node every frame, and all node/edge
 * animation. Camera follows the store's orbit state with critically damped
 * smoothing so mouse and hand input both feel fluid.
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05070c');
    scene.fog = new THREE.Fog('#05070c', 14, 34);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      80,
    );

    scene.add(new THREE.AmbientLight('#7f96c4', 0.7));
    const key = new THREE.DirectionalLight('#dfeaff', 1.6);
    key.position.set(4, 6, 8);
    scene.add(key);
    const rim = new THREE.PointLight('#22d3ee', 30, 50);
    rim.position.set(-8, 4, -6);
    scene.add(rim);

    // Starfield backdrop.
    const starCount = 900;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 18 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: '#5f7396',
      size: 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
    });
    scene.add(new THREE.Points(starGeometry, starMaterial));

    // Holographic ground rings, JARVIS-style.
    const ringGroup = new THREE.Group();
    for (let i = 1; i <= 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(i * 2.4 - 0.012, i * 2.4 + 0.012, 128),
        new THREE.MeshBasicMaterial({
          color: '#155e75',
          transparent: true,
          opacity: 0.35 - i * 0.06,
          side: THREE.DoubleSide,
        }),
      );
      ringGroup.add(ring);
    }
    ringGroup.position.z = -3.2;
    scene.add(ringGroup);

    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    // -- node + edge sync --

    const visuals = new Map<string, NodeVisual>();
    const hitMeshes: THREE.Mesh[] = [];

    // Edge buffer, rebuilt when the layout changes, repositioned every frame
    // so lines track the nodes' animated (lerped) positions.
    let edgePairs: Array<[string, string]> = [];
    const edgeGeometry = new THREE.BufferGeometry();
    let edgeAttribute = new THREE.BufferAttribute(new Float32Array(0), 3);
    const edgeLines = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({ color: '#0e7490', transparent: true, opacity: 0.45 }),
    );
    graphGroup.add(edgeLines);

    const syncLayout = () => {
      const layout = useGraphStore.getState().layout;
      const nowMs = performance.now();
      const seen = new Set<string>();

      for (const positioned of layout.nodes) {
        seen.add(positioned.node.id);
        const existing = visuals.get(positioned.node.id);
        if (existing) {
          existing.targetPosition.set(...positioned.position);
        } else {
          const visual = createNodeVisual(positioned, nowMs);
          // New nodes spawn at their parent's position and fly outward.
          const parent = positioned.parentId ? visuals.get(positioned.parentId) : null;
          if (parent) visual.group.position.copy(parent.group.position);
          visuals.set(positioned.node.id, visual);
          graphGroup.add(visual.group);
        }
      }

      for (const [id, visual] of visuals) {
        if (!seen.has(id)) {
          disposeNodeVisual(visual);
          visuals.delete(id);
        }
      }

      hitMeshes.length = 0;
      for (const visual of visuals.values()) hitMeshes.push(visual.hit);

      edgePairs = layout.edges.map((e) => [e.fromId, e.toId]);
      edgeAttribute = new THREE.BufferAttribute(new Float32Array(edgePairs.length * 6), 3);
      edgeGeometry.setAttribute('position', edgeAttribute);
    };

    syncLayout();
    const unsubscribeLayout = useGraphStore.subscribe((state, prev) => {
      if (state.layout !== prev.layout) syncLayout();
    });

    // -- per-frame animation --

    const raycaster = new THREE.Raycaster();
    const chase = { ...useGraphStore.getState().camera };
    let rafId = 0;
    let running = true;
    let lastTimeMs = 0;

    const renderLoop = (timeMs: number) => {
      if (!running) return;
      const store = useGraphStore.getState();
      const dt = lastTimeMs ? Math.min((timeMs - lastTimeMs) / 1000, 0.1) : 1 / 60;
      lastTimeMs = timeMs;

      // Camera chase (frame-rate-independent exponential smoothing).
      const k = 1 - Math.exp(-dt * 14);
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

      // Hover raycast from the store pointer (mouse or hand cursor).
      raycaster.setFromCamera(
        new THREE.Vector2(store.pointer.x * 2 - 1, -(store.pointer.y * 2 - 1)),
        camera,
      );
      const hits = raycaster.intersectObjects(hitMeshes, false);
      const hoveredId = hits.length > 0 ? (hits[0].object.userData.nodeId as string) : null;
      store.setHovered(hoveredId);

      // Node animation: position lerp, spawn scale-in, emphasis easing.
      const nowMs = performance.now();
      const posK = 1 - Math.exp(-dt * 8);
      for (const [id, visual] of visuals) {
        visual.group.position.lerp(visual.targetPosition, posK);

        const spawn = Math.min((nowMs - visual.spawnedAtMs) / 400, 1);
        const spawnEase = 1 - Math.pow(1 - spawn, 3);

        const isHovered = id === store.hoveredId;
        const isSelected = id === store.selectedId;
        const isMatched = store.matchedIds.has(id);
        const targetEmphasis = isSelected ? 1 : isHovered ? 0.75 : isMatched ? 0.5 : 0;
        visual.emphasis += (targetEmphasis - visual.emphasis) * Math.min(dt * 10, 1);

        visual.group.scale.setScalar(visual.baseScale * spawnEase * (1 + visual.emphasis * 0.35));
        visual.core.rotation.y += dt * (0.4 + visual.emphasis * 1.6);

        const material = visual.core.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 0.45 + visual.emphasis * 1.3;
        visual.glow.material.opacity = 0.3 + visual.emphasis * 0.5;

        // Labels: folders always; files when emphasized or searched.
        const isFolder = visual.core.geometry.type === 'OctahedronGeometry';
        visual.label.visible = isFolder || visual.emphasis > 0.05 || isMatched;
      }

      // Edges follow the animated node positions.
      for (let i = 0; i < edgePairs.length; i++) {
        const from = visuals.get(edgePairs[i][0]);
        const to = visuals.get(edgePairs[i][1]);
        if (!from || !to) continue;
        edgeAttribute.setXYZ(i * 2, from.group.position.x, from.group.position.y, from.group.position.z);
        edgeAttribute.setXYZ(i * 2 + 1, to.group.position.x, to.group.position.y, to.group.position.z);
      }
      edgeAttribute.needsUpdate = true;
      edgeGeometry.computeBoundingSphere();

      ringGroup.rotation.z += dt * 0.02;

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
      edgeGeometry.dispose();
      (edgeLines.material as THREE.Material).dispose();
      ringGroup.children.forEach((ring) => {
        (ring as THREE.Mesh).geometry.dispose();
        ((ring as THREE.Mesh).material as THREE.Material).dispose();
      });
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
