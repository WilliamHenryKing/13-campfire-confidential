import {
  EquirectangularReflectionMapping,
  FogExp2,
  Group,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Scene,
} from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { LAMP } from "../game/shadow";
import type { Bookmark } from "./bookmarks";
import { buildCampsite, buildSetDressing } from "./campsite";
import { createDust } from "./dust";
import { buildLantern } from "./lantern";
import { detectTier, forcedTier, modestGpu, Pipeline } from "./pipeline";
import { texturesLoaded } from "./textures";

// Renderer, camera and light. The lantern is the one key light: a point light at exactly the
// rules' lamp position, so the shadow drawn by three.js is the shadow the game judges. A dim
// night sky HDRI lights everything else and is the visible background.

/** Gas-mantle lantern, about 1000 lm: roughly 80 cd in every direction. */
const LANTERN_CD = 80;
/** Clear night sky, scaled so the lantern-lit canvas is ~100× brighter and the pines still read. */
const SKY = 0.012;
const EXPOSURE = 1.45;

export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  props: Group;
  dom: HTMLCanvasElement;
  /** Mark shadows dirty after props move. */
  invalidate(): void;
  start(onFrame: (t: number) => void, onFirst: () => void): void;
  setGlow(level: number): void;
  setView(view: Bookmark | null): void;
  setFrozen(frozen: boolean): void;
  frames(n: number): Promise<void>;
  /** Resolves when the environment map and every texture have loaded. */
  loaded: Promise<void>;
  rendererName(): string;
  dispose(): void;
}

export function createStage(host: HTMLElement, reducedMotion: boolean): Stage {
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.05, 80);
  const tier = detectTier();

  const dust = createDust(reducedMotion);
  const pipeline = new Pipeline(
    scene,
    camera,
    tier,
    () => [dust.object],
    tier === "high" && forcedTier() === null && modestGpu(),
  );
  const renderer = pipeline.renderer;
  renderer.toneMappingExposure = EXPOSURE;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.touchAction = "none";
  host.append(renderer.domElement);

  // Aerial perspective at night: distant pines sink into the sky's own colour.
  scene.fog = new FogExp2("#0b1220", 0.04);

  const lamp = new PointLight("#ffb068", LANTERN_CD, 0, 2);
  lamp.position.set(...LAMP);
  lamp.castShadow = true;
  const size = tier === "high" ? 2048 : 1024;
  lamp.shadow.mapSize.set(size, size);
  lamp.shadow.camera.near = 0.1;
  lamp.shadow.camera.far = 14;
  lamp.shadow.bias = -0.002;
  lamp.shadow.normalBias = 0.015;
  // The mantle is ~3 cm across: a small penumbra.
  lamp.shadow.radius = 3;
  scene.add(lamp);

  const lantern = buildLantern();
  scene.add(lantern.group);
  scene.add(buildCampsite());

  const props = new Group();
  scene.add(props);
  scene.add(dust.object);

  const pmrem = new PMREMGenerator(renderer);
  const env = new HDRLoader()
    .loadAsync(`${import.meta.env.BASE_URL}textures/kloppenheim_02_puresky_1k.hdr`)
    .then((hdr) => {
      hdr.mapping = EquirectangularReflectionMapping;
      scene.environment = pmrem.fromEquirectangular(hdr).texture;
      scene.environmentIntensity = SKY;
      scene.background = hdr;
      scene.backgroundIntensity = SKY;
      scene.backgroundBlurriness = 0.02;
      renderer.shadowMap.needsUpdate = true;
    })
    .catch(() => undefined);
  // Set dressing arrives after the first frame, compiled off the critical path.
  let dressed: () => void = () => {};
  const dressing = new Promise<void>((done) => {
    dressed = done;
  });
  const addSetDressing = () => {
    const extra = buildSetDressing();
    const add = () => {
      scene.add(extra);
      dressed();
    };
    if (!renderer.extensions.has("KHR_parallel_shader_compile")) return add();
    void pipeline
      .compileAsync(extra, camera, scene)
      .catch(() => undefined)
      .then(add);
  };
  const loaded = Promise.all([env, dressing])
    .then(() => texturesLoaded())
    .then(() => undefined);

  let view: Bookmark | null = null;
  const fit = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    pipeline.setSize(w, h);
    const aspect = w / h;
    camera.aspect = aspect;
    if (view) {
      camera.fov = view.fov;
      camera.position.set(...view.pos);
      camera.lookAt(...view.target);
      camera.updateProjectionMatrix();
      return;
    }
    const portrait = aspect < 0.9;
    camera.fov = portrait ? 58 : 40;
    // Frame the middle of the tent, where the figures form, so the shadows fill the view.
    const want = portrait ? 4.0 : 5.4;
    const halfV = Math.tan(((camera.fov / 2) * Math.PI) / 180);
    const dist = Math.max(portrait ? 9.2 : 8.4, want / 2 / (halfV * aspect) + 1.2);
    // Slightly off-axis, so the tent's side, guy lines and pegs recede and give it volume.
    camera.position.set(portrait ? 0.9 : 2.3, portrait ? 2.8 : 2.35, dist);
    camera.lookAt(portrait ? 0.1 : 0.15, portrait ? 1.35 : 1.7, portrait ? 1.0 : 0.6);
    camera.updateProjectionMatrix();
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(host);

  // Adaptive quality: if frames stay slower than ~60 fps for two seconds, shed a pass.
  const adaptive = forcedTier() === null;
  let slowSince = -1;
  let lastNow = -1;
  let startedAt = -1;
  const watchFrameTime = (now: number) => {
    if (startedAt < 0) startedAt = now;
    const dt = lastNow < 0 ? 0 : now - lastNow;
    lastNow = now;
    // Ignore the first seconds (shader compiles) and hidden-tab gaps.
    if (!adaptive || now - startedAt < 4000 || dt > 250) return;
    if (dt > 18) {
      if (slowSince < 0) slowSince = now;
      else if (now - slowSince > 2000) {
        pipeline.degrade();
        slowSince = -1;
        startedAt = now - 3000; // let the lighter frame settle before judging again
      }
    } else slowSince = -1;
  };

  let raf = 0;
  let glow = 1;
  let frozenAt: number | null = null;
  const waiters: { left: number; done: () => void }[] = [];
  return {
    scene,
    camera,
    props,
    dom: renderer.domElement,
    loaded,
    invalidate() {
      renderer.shadowMap.needsUpdate = true;
    },
    setGlow(level) {
      glow = level;
    },
    setView(next) {
      view = next;
      fit();
    },
    setFrozen(frozen) {
      frozenAt = frozen ? (frozenAt ?? performance.now()) : null;
    },
    frames(n) {
      return new Promise((done) => waiters.push({ left: n, done }));
    },
    rendererName() {
      const gl = renderer.getContext();
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    },
    start(onFrame, onFirst) {
      let first = true;
      renderer.shadowMap.needsUpdate = true;
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        watchFrameTime(now);
        const t = frozenAt ?? now;
        onFrame(t);
        dust.tick(t);
        // A pressure lantern breathes a little; the mantle and its light move together.
        const flicker = reducedMotion
          ? 1
          : 1 + 0.025 * Math.sin(t * 0.011) + 0.015 * Math.sin(t * 0.027 + 1.3);
        lamp.intensity = LANTERN_CD * glow * flicker;
        lantern.mantle.emissiveIntensity = 60 * glow * flicker;
        pipeline.render();
        if (first) {
          first = false;
          onFirst();
          // After the veil has faded, so its compile cannot stall the fade.
          window.setTimeout(addSetDressing, 1200);
        }
        for (let i = waiters.length - 1; i >= 0; i--) {
          const w = waiters[i];
          if (w && --w.left <= 0) {
            waiters.splice(i, 1);
            w.done();
          }
        }
      };
      // Where the driver compiles shaders in parallel (KHR_parallel_shader_compile), compile the
      // whole scene up front; without it the async path only adds a second pass, so draw now.
      if (!renderer.extensions.has("KHR_parallel_shader_compile")) {
        raf = requestAnimationFrame(loop);
        return;
      }
      // After the sky is in: an environment map changes every standard program.
      void env
        .then(() => pipeline.compileAsync(scene, camera))
        .catch(() => undefined)
        .then(() => {
          pipeline.warm(scene);
          raf = requestAnimationFrame(loop);
        });
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      pmrem.dispose();
      pipeline.dispose();
      renderer.domElement.remove();
    },
  };
}
