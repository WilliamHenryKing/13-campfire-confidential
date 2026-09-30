import { afterEach, expect, test } from "bun:test";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera } from "three";
import { attachInput, type InputBinding } from "../src/scene/input";

class CanvasEvents extends EventTarget {
  readonly style = { cursor: "" };
  readonly captured = new Set<number>();
  readonly clientHeight = 200;
  width = 200;
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width, height: 200 };
  }
  setPointerCapture(id: number) {
    this.captured.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captured.has(id);
  }
  releasePointerCapture(id: number) {
    this.captured.delete(id);
    this.pointer("lostpointercapture", id);
  }
  pointer(type: string, id: number, x = 100, y = 100, button = 0) {
    this.dispatchEvent(
      Object.assign(new Event(type), {
        pointerId: id,
        pointerType: "touch",
        clientX: x,
        clientY: y,
        button,
      }),
    );
  }
  wheel(deltaY: number, deltaMode = 0) {
    this.dispatchEvent(
      Object.assign(new Event("wheel", { cancelable: true }), { deltaY, deltaMode }),
    );
  }
}

const bindings: InputBinding[] = [];
const meshes: Mesh[] = [];
function fixture() {
  const canvas = new CanvasEvents();
  const camera = new PerspectiveCamera(40, 1, 0.1, 20);
  camera.position.z = 5;
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const group = new Group();
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  group.position.z = 1;
  group.add(mesh);
  group.updateMatrixWorld(true);
  meshes.push(mesh);
  const selected: number[] = [];
  const drags: number[] = [];
  const depths: number[] = [];
  let released = 0;
  let engagements = 0;
  const binding = attachInput(canvas as unknown as HTMLElement, camera, {
    pickable: () => [group],
    depthOf: () => 1,
    positionOf: () => ({ x: 0, y: 0 }),
    engage: () => engagements++,
    select: (index) => selected.push(index),
    drag: (_, x) => drags.push(x),
    depth: (step) => depths.push(step),
    release: () => released++,
  });
  bindings.push(binding);
  return {
    canvas,
    binding,
    selected,
    drags,
    depths,
    released: () => released,
    engaged: () => engagements,
  };
}

afterEach(() => {
  for (const binding of bindings.splice(0)) binding.dispose();
  for (const mesh of meshes.splice(0)) {
    mesh.geometry.dispose();
    (mesh.material as MeshBasicMaterial).dispose();
  }
});

test("closing the input gate ends a drag and blocks pointer and wheel changes", () => {
  const f = fixture();
  f.canvas.pointer("pointerdown", 1);
  f.canvas.pointer("pointermove", 1, 110);
  expect(f.selected).toEqual([0]);
  expect(f.drags[0]).toBeGreaterThan(0);
  f.binding.setInteractive(false);
  expect(f.released()).toBe(1);
  expect(f.canvas.captured.size).toBe(0);
  f.canvas.pointer("pointermove", 1, 130);
  f.canvas.pointer("pointerdown", 2);
  f.canvas.wheel(120);
  expect(f.drags).toHaveLength(1);
  expect(f.selected).toHaveLength(1);
  expect(f.depths).toEqual([]);
  f.binding.setInteractive(true);
  f.canvas.pointer("pointerdown", 2);
  f.canvas.pointer("pointerup", 2);
  expect(f.selected).toEqual([0, 0]);
  expect(f.released()).toBe(2);
});

test("pinch captures both background fingers and ignores a third touch", () => {
  const f = fixture();
  f.canvas.pointer("pointerdown", 1, 5);
  f.canvas.pointer("pointerdown", 2, 195);
  f.canvas.pointer("pointerdown", 3);
  expect([...f.canvas.captured]).toEqual([1, 2]);
  f.canvas.pointer("pointermove", 3, 400);
  expect(f.depths).toEqual([]);
  f.canvas.pointer("pointermove", 2, 250);
  expect(f.depths).toEqual([1]);
  f.canvas.pointer("pointerup", 1, -100);
  expect(f.released()).toBe(0);
  f.canvas.pointer("pointerup", 2, 300);
  expect(f.released()).toBe(1);
  expect(f.canvas.captured.size).toBe(0);
  f.canvas.pointer("pointerdown", 4);
  f.canvas.pointer("pointermove", 4, 110);
  expect(f.selected).toEqual([0]);
  expect(f.drags).toHaveLength(1);
});

test("pointer cancellation clears the entire pinch without stale depth changes", () => {
  const f = fixture();
  f.canvas.pointer("pointerdown", 1, 5);
  f.canvas.pointer("pointerdown", 2, 195);
  f.canvas.pointer("pointercancel", 1);
  expect(f.released()).toBe(1);
  expect(f.canvas.captured.size).toBe(0);
  f.canvas.pointer("pointermove", 2, 300);
  f.canvas.pointer("pointerup", 2, 300);
  expect(f.depths).toEqual([]);
  expect(f.released()).toBe(1);
  expect(f.canvas.style.cursor).toBe("");
});

test("a stationary background pinch blocks settlement until both fingers are released", () => {
  const f = fixture();
  f.canvas.pointer("pointerdown", 1, 5);
  f.canvas.pointer("pointerdown", 2, 195);
  expect(f.engaged()).toBe(1);
  expect(f.selected).toEqual([]);
  expect(f.depths).toEqual([]);
  f.canvas.pointer("pointerup", 1);
  expect(f.released()).toBe(0);
  f.canvas.pointer("pointerup", 2);
  expect(f.released()).toBe(1);
});

test("lost capture ends a drag and disposal removes every listener silently", () => {
  const f = fixture();
  f.canvas.pointer("pointerdown", 1);
  f.canvas.releasePointerCapture(1);
  expect(f.released()).toBe(1);
  f.canvas.pointer("pointermove", 1, 130);
  expect(f.drags).toEqual([]);
  f.canvas.pointer("pointerdown", 2);
  f.binding.dispose();
  expect(f.released()).toBe(1);
  expect(f.canvas.captured.size).toBe(0);
  f.canvas.pointer("pointerdown", 3);
  f.canvas.wheel(120);
  expect(f.selected).toEqual([0, 0]);
  expect(f.depths).toEqual([]);
});

test("secondary buttons and a zero-size canvas cannot start a drag", () => {
  const f = fixture();
  f.canvas.pointer("pointerdown", 1, 100, 100, 2);
  f.canvas.width = 0;
  f.canvas.pointer("pointerdown", 2);
  expect(f.selected).toEqual([]);
  expect(f.canvas.captured.size).toBe(0);
});

test("line-mode wheel events use their pixel equivalent and release the action", () => {
  const f = fixture();
  f.canvas.wheel(-4, 1);
  expect(f.depths).toEqual([1]);
  expect(f.released()).toBe(1);
});
