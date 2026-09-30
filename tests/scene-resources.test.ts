import { expect, test } from "bun:test";
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Texture } from "three";
import { disposeTree, materialTextures } from "../src/scene/resources";
import { disposeTextures, tile } from "../src/scene/textures";

test("retiring a chapter frees tiled and shader maps once while retaining source images", () => {
  const original = new Texture();
  const map = tile(original, 0.5);
  const paint = tile(original, 0.8);
  const pending = tile(original, 1);
  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial({ map, roughnessMap: map });
  materialTextures(material, paint);
  const instance = new InstancedMesh(geometry, material, 2);
  const group = new Group();
  group.add(new Mesh(geometry, [material, material]), instance);
  const resources: { addEventListener(type: "dispose", listener: () => void): void }[] = [
    original,
    map,
    paint,
    pending,
    geometry,
    material,
    instance,
  ];
  const disposed = resources.map(() => 0);
  resources.forEach((resource, i) => {
    resource.addEventListener("dispose", () => {
      disposed[i] = (disposed[i] ?? 0) + 1;
    });
  });

  disposeTree(group);
  expect(disposed).toEqual([0, 1, 1, 0, 1, 1, 1]);
  expect(group.children).toHaveLength(0);
  disposeTextures();
  expect(disposed).toEqual([0, 1, 1, 1, 1, 1, 1]);
  expect(original.source).toBe(map.source);
});
