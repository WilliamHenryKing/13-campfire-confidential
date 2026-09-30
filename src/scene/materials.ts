import {
  Color,
  CustomBlending,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderChunk,
  type Texture,
  Vector2,
} from "three";
import { materialTextures } from "./resources";
import { macroNoise, type PbrSet, paintMask, pbrSet, tile, tiled } from "./textures";

// Material roles. Sourced CC0 scans (see assets.manifest.json) supply colour, normal and
// AO·roughness·metalness at real-world scale; shader patches add what a single scan cannot:
// macro colour variation against tiling, thin-fabric translucency, and paint that has chipped
// down to bare metal. No emissive boosts: only the lantern mantle glows, and it has a light.

let macro: Texture | null = null;
const macroTexture = () => {
  macro ??= macroNoise();
  return macro;
};

function applyPbr(m: MeshStandardMaterial, set: PbrSet | null, normalScale = 1) {
  if (!set) return m;
  m.map = set.colour;
  m.normalMap = set.normal;
  m.normalScale = new Vector2(normalScale, normalScale);
  m.roughnessMap = set.arm;
  m.aoMap = set.arm;
  m.aoMapIntensity = 0.8;
  return m;
}

/** Macro variation: multiply the albedo by a slow noise so repeats never line up. */
function withMacro(m: MeshStandardMaterial, scale: number, low: number, high: number, key: string) {
  const previous = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    previous.call(m, shader, renderer);
    shader.uniforms.uMacro = { value: macroTexture() };
    materialTextures(m, macroTexture());
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform sampler2D uMacro;\nvoid main() {")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        diffuseColor.rgb *= mix(${low.toFixed(3)}, ${high.toFixed(3)}, texture2D(uMacro, vMapUv * ${scale.toFixed(4)}).r);`,
      );
  };
  const keyed = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${keyed()}|macro-${key}`;
  return m;
}

/** Thin woven canvas: light arriving on the far side passes through, dimmed and warmed. */
const translucentLights =
  `uniform vec3 uTranslucency;\n${ShaderChunk.lights_physical_pars_fragment}`.replace(
    "float dotNL = saturate( dot( geometryNormal, directLight.direction ) );",
    `float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
  float backNL = saturate( -dot( geometryNormal, directLight.direction ) );
  reflectedLight.directDiffuse += backNL * directLight.color * BRDF_Lambert( material.diffuseColor ) * uTranslucency;`,
  );

/**
 * Woven tent canvas. `grime` darkens the lowest ~45 cm where rain splashes mud onto the hem
 * (UV v runs in metres of weave repeats from the ground up).
 */
export function tentCanvas(repeatU: number, repeatV: number, tint = 1, grime = true) {
  const set = tiled(pbrSet("rough_linen"), repeatU, repeatV);
  // The scan's weave averages ~0.3 linear; this lifts undyed cotton duck to ~0.55 albedo.
  const color = new Color().setRGB(1.9 * tint, 1.58 * tint, 1.1 * tint);
  const m = applyPbr(
    new MeshStandardMaterial({ name: "tent-canvas", color, roughness: 1, side: DoubleSide }),
    set,
    1.5,
  );
  withMacro(m, 0.016, 0.84, 1.08, "canvas");
  const previous = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    previous.call(m, shader, renderer);
    shader.uniforms.uTranslucency = { value: new Color(0.6, 0.46, 0.28) };
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_physical_pars_fragment>",
      translucentLights,
    );
    if (grime)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float hemHeight = vMapUv.y * 0.27;
        diffuseColor.rgb *= mix( vec3( 0.5, 0.44, 0.36 ), vec3( 1.0 ), smoothstep( 0.02, 0.45, hemHeight ) );`,
      );
  };
  const keyed = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${keyed()}|translucent|${grime}`;
  return m;
}

/** Forest floor with two scales of the same scan blended by macro noise, so no tile repeats. */
export function forestFloor(repeat: number) {
  const set = tiled(pbrSet("forest_floor"), repeat, repeat);
  const m = applyPbr(
    new MeshStandardMaterial({ name: "forest-floor", color: "#9a8f7c", roughness: 1 }),
    set,
    1.1,
  );
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uMacro = { value: macroTexture() };
    materialTextures(m, macroTexture());
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform sampler2D uMacro;\nvoid main() {")
      .replace(
        "#include <map_fragment>",
        `vec4 floorA = texture2D( map, vMapUv );
        vec4 floorB = texture2D( map, vMapUv * 0.61 + vec2( 0.37, 0.11 ) );
        float floorMix = smoothstep( 0.38, 0.62, texture2D( uMacro, vMapUv * 0.09 ).r );
        diffuseColor *= mix( floorA, floorB, floorMix );
        diffuseColor.rgb *= mix( 0.7, 1.1, texture2D( uMacro, vMapUv * 0.031 + 0.5 ).r );`,
      );
  };
  m.customProgramCacheKey = () => "forest-floor-breakup";
  return m;
}

/**
 * Painted or enamelled steel that has chipped: a paint-survival mask from the painted-metal
 * scan decides where the tint gives way to dark bare steel, which is rougher and metallic.
 */
export function chippedPaint(tint: string, name: string, chips = "#2c2a27", gloss = 0.3) {
  const set = pbrSet("rusty_painted_metal");
  const scale = 0.55;
  const m = new MeshPhysicalMaterial({
    name,
    color: tint,
    roughness: gloss,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.25,
  });
  m.normalMap = tile(set.normal, scale);
  m.normalScale = new Vector2(0.35, 0.35);
  const mask = tile(paintMask(), scale);
  materialTextures(m, mask);
  const chip = new Color(chips);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uPaint = { value: mask };
    shader.uniforms.uChip = { value: chip };
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform sampler2D uPaint;\nuniform vec3 uChip;\nvoid main() {")
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        float paintLeft = smoothstep( 0.22, 0.5, texture2D( uPaint, vNormalMapUv ).r );
        diffuseColor.rgb = mix( uChip, diffuseColor.rgb, paintLeft );
        roughnessFactor = mix( 0.62, roughnessFactor, paintLeft );
        metalnessFactor = mix( 0.85, metalnessFactor, paintLeft );`,
      );
  };
  // Same shader for every paint colour: one program, compiled once.
  m.customProgramCacheKey = () => "chipped-paint";
  return m;
}

export function steel(name = "steel", color = "#8f959a", roughness = 0.42) {
  const arm = tile(pbrSet("rusty_painted_metal").arm, 0.8);
  return new MeshStandardMaterial({ name, color, metalness: 1, roughness, roughnessMap: arm });
}

export function scanned(
  setName: string,
  name: string,
  tint: string,
  repeat = 1,
  normalScale = 1,
): MeshStandardMaterial {
  const set = tiled(pbrSet(setName), repeat, repeat);
  return applyPbr(new MeshStandardMaterial({ name, color: tint, roughness: 1 }), set, normalScale);
}

/** Thin glass: reflection by Fresnel, the background passes through (from ODD TIDE). */
export function glass(tint = new Color(0.95, 0.93, 0.88)) {
  const m = new MeshPhysicalMaterial({
    name: "lantern-glass",
    color: tint,
    roughness: 0.04,
    metalness: 0,
    ior: 1.52,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  m.blending = CustomBlending;
  m.blendSrc = OneFactor;
  m.blendDst = OneMinusSrcAlphaFactor;
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <map_fragment>", "#include <map_fragment>\n diffuseColor.rgb *= 0.02;")
      .replace(
        "#include <opaque_fragment>",
        `float glassCos = saturate(abs(dot(normal, normalize(vViewPosition))));
        float glassFresnel = 0.04 + 0.96 * pow(1.0 - glassCos, 5.0);
        gl_FragColor = vec4(outgoingLight, clamp(glassFresnel + 0.06, 0.0, 1.0));`,
      );
  };
  m.customProgramCacheKey = () => "campfire-glass-v1";
  return m;
}
