import { type Camera, type Object3D, Plane, Raycaster, Vector2, Vector3 } from "three";

// Pointer handling on the canvas: tap a prop to pick it, drag to slide it parallel to the
// tent (its shadow follows), wheel or pinch to bring it toward the lamp.

export interface InputHandlers {
  pickable(): Object3D[];
  depthOf(index: number): number;
  positionOf(index: number): { x: number; y: number };
  select(index: number): void;
  drag(index: number, x: number, y: number): void;
  depth(steps: number): void;
  release(): void;
}

export function attachInput(dom: HTMLElement, camera: Camera, h: InputHandlers): () => void {
  const ray = new Raycaster();
  const ndc = new Vector2();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const hit = new Vector3();
  const pointers = new Map<number, { x: number; y: number }>();
  let dragging: { index: number; dx: number; dy: number; id: number } | null = null;
  let pinch = 0;
  let wheelAcc = 0;

  const aim = (e: PointerEvent | WheelEvent) => {
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };

  const pick = (): number => {
    const objects = h.pickable();
    const hits = ray.intersectObjects(objects, true);
    const first = hits[0];
    if (!first) return -1;
    let o: Object3D | null = first.object;
    while (o && !objects.includes(o)) o = o.parent;
    return o ? objects.indexOf(o) : -1;
  };

  const onDown = (e: PointerEvent) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      if (a && b) pinch = Math.hypot(a.x - b.x, a.y - b.y);
      dragging = null;
      return;
    }
    aim(e);
    const index = pick();
    if (index < 0) return;
    h.select(index);
    plane.constant = -h.depthOf(index);
    if (!ray.ray.intersectPlane(plane, hit)) return;
    const at = h.positionOf(index);
    dragging = { index, dx: at.x - hit.x, dy: at.y - hit.y, id: e.pointerId };
    dom.setPointerCapture(e.pointerId);
    dom.style.cursor = "grabbing";
  };

  const onMove = (e: PointerEvent) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (Math.abs(d - pinch) > 28) {
        h.depth(d > pinch ? 1 : -1);
        pinch = d;
      }
      return;
    }
    aim(e);
    if (dragging && dragging.id === e.pointerId) {
      if (ray.ray.intersectPlane(plane, hit))
        h.drag(dragging.index, hit.x + dragging.dx, hit.y + dragging.dy);
      return;
    }
    if (e.pointerType === "mouse") dom.style.cursor = pick() >= 0 ? "grab" : "default";
  };

  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pinch && pointers.size < 2) {
      pinch = 0;
      h.release();
    }
    if (dragging && dragging.id === e.pointerId) {
      dragging = null;
      dom.style.cursor = "grab";
      h.release();
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) >= 60) {
      h.depth(wheelAcc < 0 ? 1 : -1);
      wheelAcc = 0;
      h.release();
    }
  };

  dom.addEventListener("pointerdown", onDown);
  dom.addEventListener("pointermove", onMove);
  dom.addEventListener("pointerup", onUp);
  dom.addEventListener("pointercancel", onUp);
  dom.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    dom.removeEventListener("pointerdown", onDown);
    dom.removeEventListener("pointermove", onMove);
    dom.removeEventListener("pointerup", onUp);
    dom.removeEventListener("pointercancel", onUp);
    dom.removeEventListener("wheel", onWheel);
  };
}
