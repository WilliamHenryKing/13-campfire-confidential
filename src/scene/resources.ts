import * as THREE from "three";
import { disposeTexture } from "./textures";

const shaderTextures = new WeakMap<THREE.Material, Set<THREE.Texture>>();

/** Textures hidden in onBeforeCompile uniforms still belong to their material. */
export function materialTextures(material: THREE.Material, ...textures: THREE.Texture[]) {
  const owned = shaderTextures.get(material) ?? new Set<THREE.Texture>();
  for (const texture of textures) owned.add(texture);
  shaderTextures.set(material, owned);
}

/** A chapter owns its prop maps; a stage owns all remaining scene resources. */
export function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) object.dispose();
    if (
      object instanceof THREE.DirectionalLight ||
      object instanceof THREE.PointLight ||
      object instanceof THREE.SpotLight
    )
      object.shadow.dispose();
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points ||
      object instanceof THREE.Sprite
    ) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
        for (const texture of shaderTextures.get(material) ?? []) textures.add(texture);
      }
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) disposeTexture(texture);
  root.clear();
}
