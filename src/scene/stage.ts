import {
  ACESFilmicToneMapping,
  Color,
  CylinderGeometry,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  SpotLight,
  WebGLRenderer,
} from "three";
import { LAMP } from "../game/shadow";
import { buildCampsite } from "./campsite";

// Renderer, camera and light. The spotlight sits exactly at the rules' lamp position so the
// shadow drawn by three.js is the shadow the game judges.

export interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  props: Group;
  /** Mark shadows dirty after props move. */
  invalidate(): void;
  start(onFrame: (t: number) => void, onFirst: () => void): void;
  setGlow(level: number): void;
  dispose(): void;
}

export function createStage(host: HTMLElement, reducedMotion: boolean): Stage {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.touchAction = "none";
  host.append(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color("#0b0d16");
  scene.fog = new Fog("#0b0d16", 11, 26);

  const camera = new PerspectiveCamera(40, 1, 0.1, 60);

  scene.add(new HemisphereLight("#44507a", "#2a1f16", 0.55));

  const key = new SpotLight("#ffb46a", 95, 0, 1.02, 0.55, 2);
  key.position.set(...LAMP);
  key.target.position.set(0, 1.55, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.3;
  key.shadow.camera.far = 9;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 3;
  scene.add(key, key.target);

  const fill = new PointLight("#ff9b4a", 3.2, 6, 2);
  fill.position.set(LAMP[0], LAMP[1] + 0.25, LAMP[2] + 0.2);
  scene.add(fill);

  const glass = new Mesh(
    new CylinderGeometry(0.07, 0.07, 0.16, 20),
    new MeshStandardMaterial({ color: "#ffd9a0", emissive: "#ffb25e", emissiveIntensity: 2.4 }),
  );
  glass.position.set(...LAMP);
  const lanternBody = new Group();
  const dark = new MeshStandardMaterial({ color: "#23201d", roughness: 0.6, metalness: 0.4 });
  const base = new Mesh(new CylinderGeometry(0.09, 0.1, 0.06, 20), dark);
  base.position.set(LAMP[0], LAMP[1] - 0.11, LAMP[2]);
  const cap = new Mesh(new CylinderGeometry(0.02, 0.1, 0.08, 20), dark);
  cap.position.set(LAMP[0], LAMP[1] + 0.12, LAMP[2]);
  const foot = new Mesh(new CylinderGeometry(0.035, 0.05, LAMP[1] - 0.14, 12), dark);
  foot.position.set(LAMP[0], (LAMP[1] - 0.14) / 2, LAMP[2]);
  lanternBody.add(glass, base, cap, foot);
  scene.add(lanternBody);

  const campsite = buildCampsite();
  scene.add(campsite);

  const props = new Group();
  scene.add(props);

  const fit = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    const aspect = w / h;
    const portrait = aspect < 0.9;
    camera.aspect = aspect;
    camera.fov = portrait ? 56 : 38;
    // Keep the middle of the tent wall in frame at any aspect.
    const want = portrait ? 4.1 : 7.4;
    const halfV = Math.tan(((camera.fov / 2) * Math.PI) / 180);
    const dist = Math.max(8.2, want / 2 / (halfV * aspect) + 0.6);
    camera.position.set(portrait ? 0.35 : 1.3, portrait ? 2.25 : 2.1, dist);
    camera.lookAt(0, portrait ? 1.45 : 1.6, 0.6);
    camera.updateProjectionMatrix();
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(host);

  let raf = 0;
  let glow = 1;
  return {
    renderer,
    scene,
    camera,
    props,
    invalidate() {
      renderer.shadowMap.needsUpdate = true;
    },
    setGlow(level) {
      glow = level;
    },
    start(onFrame, onFirst) {
      let first = true;
      renderer.shadowMap.needsUpdate = true;
      const loop = (t: number) => {
        raf = requestAnimationFrame(loop);
        onFrame(t);
        const flicker = reducedMotion
          ? 1
          : 1 + 0.035 * Math.sin(t * 0.011) + 0.02 * Math.sin(t * 0.027 + 1.3);
        key.intensity = 95 * glow * flicker;
        fill.intensity = 3.2 * glow * flicker;
        (glass.material as MeshStandardMaterial).emissiveIntensity = 2.4 * glow * flicker;
        renderer.render(scene, camera);
        if (first) {
          first = false;
          onFirst();
        }
      };
      raf = requestAnimationFrame(loop);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
