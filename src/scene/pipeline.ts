import {
  type Camera,
  HalfFloatType,
  NeutralToneMapping,
  type Object3D,
  PCFShadowMap,
  type Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

// One lighting model: the scene renders linear HDR, GTAO darkens contact, bloom takes only
// energy above an HDR threshold (the lantern mantle), a scotopic grade gives the night look,
// OutputPass applies Neutral tone mapping and the sRGB transfer exactly once, and SMAA cleans edges in display
// space. Adapted from ODD TIDE's pipeline (same author, reuse authorised).

/** Linear-light grade: dim regions drift toward rod vision; lamplit regions stay photopic. */
const GradeShader = {
  name: "CampfireGrade",
  uniforms: {
    tDiffuse: { value: null },
    night: { value: 1 },
    vignette: { value: 0.22 },
    aspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float night;
    uniform float vignette;
    uniform float aspect;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 c = texel.rgb;
      float photopic = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float scotopic = dot(c, vec3(0.03, 0.62, 0.52));
      float rods = night * (1.0 - smoothstep(0.015, 0.35, photopic));
      c = mix(c, vec3(0.55, 0.78, 1.18) * scotopic * 0.8, rods * 0.8);
      vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
      c *= 1.0 - vignette * smoothstep(0.35, 1.05, length(p));
      gl_FragColor = vec4(c, texel.a);
    }
  `,
};

type VisibilityPatched = { _overrideVisibility(): void; _visibilityCache: Object3D[] };

export type Tier = "high" | "low";

/** Phones and small touch screens get the light tier: no GTAO, smaller buffers. */
/** A tier chosen in the URL (?tier=high|low) is fixed: captures must not change mid-run. */
export function forcedTier(): Tier | null {
  const forced = new URLSearchParams(window.location.search).get("tier");
  return forced === "low" || forced === "high" ? forced : null;
}

export function detectTier(): Tier {
  const forced = forcedTier();
  if (forced) return forced;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  return coarse || small ? "low" : "high";
}

export class Pipeline {
  readonly renderer: WebGLRenderer;
  readonly composer: EffectComposer;
  readonly ao: GTAOPass | null;
  readonly bloom: UnrealBloomPass;
  readonly grade: ShaderPass;
  private readonly smaa: SMAAPass;
  private pixelRatio: number;

  constructor(
    scene: Scene,
    camera: Camera,
    readonly tier: Tier,
    aoHidden: () => Object3D[],
  ) {
    this.renderer = new WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
      stencil: false,
    });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, tier === "high" ? 2 : 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = SRGBColorSpace;
    // Neutral keeps the lantern's warm canvas saturated where AgX drifted it toward grey.
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    // Shadows are redrawn only when a prop moves (Stage.invalidate).
    this.renderer.shadowMap.autoUpdate = false;

    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
    target.texture.name = "Campfire.hdr";
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));

    if (tier === "high") {
      const ao = new GTAOPass(scene, camera, 1, 1);
      ao.blendIntensity = 0.9;
      ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.6, thickness: 0.6, scale: 1 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2 });
      const patched = ao as unknown as VisibilityPatched;
      const original = patched._overrideVisibility.bind(ao);
      patched._overrideVisibility = () => {
        original();
        for (const object of aoHidden())
          if (object.visible) {
            object.visible = false;
            patched._visibilityCache.push(object);
          }
      };
      this.composer.addPass(ao);
      this.ao = ao;
    } else {
      this.ao = null;
    }

    // Glare from the mantle only: energy above the threshold, clamped so a bright source cannot
    // flood the frame.
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.25, 0.4, 9);
    const highPass = this.bloom.materialHighPassFilter;
    highPass.fragmentShader = highPass.fragmentShader.replace(
      "gl_FragColor = mix( outputColor, texel, alpha );",
      `vec3 above = texel.rgb * (max(v - luminosityThreshold, 0.0) / max(v, 1e-4));
        above *= min(1.0, 8.0 / max(luminance(above), 1e-4));
        gl_FragColor = vec4(above, 1.0);`,
    );
    highPass.needsUpdate = true;
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.smaa = new SMAAPass();
    this.composer.addPass(this.smaa);
  }

  get domElement() {
    return this.renderer.domElement;
  }

  setSize(width: number, height: number) {
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(width, height);
    const uniforms = this.grade.uniforms as Record<string, { value: number }>;
    if (uniforms.aspect) uniforms.aspect.value = width / Math.max(height, 1);
  }

  render() {
    this.composer.render();
  }

  /**
   * Adaptive quality: shed the heaviest pass first. Returns false once nothing is left to drop.
   * Step 1 turns GTAO off; step 2 lowers the pixel ratio to 1.
   */
  degrade(): boolean {
    if (this.ao?.enabled) {
      this.ao.enabled = false;
      return true;
    }
    if (this.pixelRatio > 1) {
      this.pixelRatio = 1;
      const size = this.renderer.getSize(new Vector2());
      this.setSize(size.x, size.y);
      return true;
    }
    return false;
  }

  dispose() {
    this.ao?.dispose();
    this.bloom.dispose();
    this.smaa.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
