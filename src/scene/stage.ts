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
import { createDust } from "./dust";

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
  renderer.toneMappingExposure = 0.95;
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

  // Low ambient keeps the umbra dark, so the figure reads clearly on the bright canvas.
  scene.add(new HemisphereLight("#44507a", "#2a1f16", 0.26));

  const key = new SpotLight("#ffbf80", 80, 0, 1.02, 0.6, 2);
  key.position.set(...LAMP);
  key.target.position.set(0, 1.55, 0);
  key.castShadow = true;
  const big = Math.min(window.innerWidth, window.innerHeight) > 600;
  key.shadow.mapSize.set(big ? 4096 : 2048, big ? 4096 : 2048);
  key.shadow.camera.near = 0.3;
  key.shadow.camera.far = 9;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 2;
  scene.add(key, key.target);

  // Warm spill on the lantern and nearby grass only; it stops short of the tent wall.
  const fill = new PointLight("#ff9b4a", 3.2, 3.6, 2);
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

  const dust = createDust(reducedMotion);
  scene.add(dust.object);

  const fit = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    const aspect = w / h;
    const portrait = aspect < 0.9;
    camera.aspect = aspect;
    camera.fov = portrait ? 58 : 40;
    // Frame the middle of the tent, where the figures form, so the shadows fill the view.
    const want = portrait ? 4.0 : 5.4;
    const halfV = Math.tan(((camera.fov / 2) * Math.PI) / 180);
    const dist = Math.max(portrait ? 9.2 : 8.4, want / 2 / (halfV * aspect) + 1.2);
    camera.position.set(portrait ? 0.35 : 1.1, portrait ? 2.8 : 2.45, dist);
    camera.lookAt(0, portrait ? 1.3 : 1.5, 1.0);
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
        dust.tick(t);
        const flicker = reducedMotion
          ? 1
          : 1 + 0.035 * Math.sin(t * 0.011) + 0.02 * Math.sin(t * 0.027 + 1.3);
        key.intensity = 80 * glow * flicker;
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
