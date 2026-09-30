import { type Camera, type Object3D, Plane, Raycaster, Vector2, Vector3 } from "three";

// Every accepted pointer is captured, including a pinch started on the canvas background.
// Cancellation and lost capture end the whole gesture, so no stale finger can move a prop.
export interface InputHandlers {
  pickable(): Object3D[];
  depthOf(index: number): number;
  positionOf(index: number): { x: number; y: number };
  /** A background pinch is an interaction even before its first depth change. */
  engage?(): void;
  select(index: number): void;
  drag(index: number, x: number, y: number): void;
  depth(steps: number): void;
  release(): void;
}

export interface InputBinding {
  setInteractive(interactive: boolean): void;
  dispose(): void;
}

export function attachInput(dom: HTMLElement, camera: Camera, h: InputHandlers): InputBinding {
  const ray = new Raycaster();
  const ndc = new Vector2();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const hit = new Vector3();
  const pointers = new Map<number, { x: number; y: number }>();
  let dragging: { index: number; dx: number; dy: number; id: number } | null = null;
  let interactive = true;
  let engaged = false;
  let pinch = 0;
  let wheelAcc = 0;

  const aim = (e: PointerEvent | WheelEvent) => {
    const r = dom.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return true;
  };

  const pick = (): number => {
    const objects = h.pickable();
    const first = ray.intersectObjects(objects, true)[0];
    if (!first) return -1;
    let o: Object3D | null = first.object;
    while (o && !objects.includes(o)) o = o.parent;
    return o ? objects.indexOf(o) : -1;
  };

  const cancel = (notify: boolean) => {
    const ids = [...pointers.keys()];
    const release = engaged;
    pointers.clear();
    dragging = null;
    engaged = false;
    pinch = 0;
    wheelAcc = 0;
    dom.style.cursor = "";
    for (const id of ids) if (dom.hasPointerCapture(id)) dom.releasePointerCapture(id);
    if (notify && release) h.release();
  };

  const onDown = (e: PointerEvent) => {
    if (!interactive || e.button !== 0 || pointers.size >= 2 || !h.pickable().length || !aim(e))
      return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dom.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      if (a && b) pinch = Math.hypot(a.x - b.x, a.y - b.y);
      dragging = null;
      engaged = true;
      h.engage?.();
      dom.style.cursor = "grabbing";
      return;
    }
    const index = pick();
    if (index < 0) return;
    h.select(index);
    engaged = true;
    plane.constant = -h.depthOf(index);
    if (!ray.ray.intersectPlane(plane, hit)) return;
    const at = h.positionOf(index);
    dragging = { index, dx: at.x - hit.x, dy: at.y - hit.y, id: e.pointerId };
    dom.style.cursor = "grabbing";
  };

  const onMove = (e: PointerEvent) => {
    if (!interactive) return;
    const tracked = pointers.has(e.pointerId);
    if (tracked) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      if (!tracked) return;
      const [a, b] = [...pointers.values()];
      if (!a || !b) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (Math.abs(d - pinch) > 28) {
        h.depth(d > pinch ? 1 : -1);
        pinch = d;
      }
      return;
    }
    if (!aim(e)) return;
    if (dragging && dragging.id === e.pointerId) {
      if (ray.ray.intersectPlane(plane, hit))
        h.drag(dragging.index, hit.x + dragging.dx, hit.y + dragging.dy);
      return;
    }
    if (e.pointerType === "mouse") dom.style.cursor = pick() >= 0 ? "grab" : "";
  };

  const onUp = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return;
    if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
    if (dragging?.id === e.pointerId) dragging = null;
    if (pointers.size < 2) pinch = 0;
    if (!pointers.size) cancel(true);
  };
  const onCancel = () => cancel(true);
  const onLost = (e: PointerEvent) => {
    if (pointers.has(e.pointerId)) cancel(true);
  };

  const onWheel = (e: WheelEvent) => {
    if (!interactive || !h.pickable().length) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? dom.clientHeight : 1;
    wheelAcc += e.deltaY * unit;
    if (Math.abs(wheelAcc) >= 60) {
      h.depth(wheelAcc < 0 ? 1 : -1);
      wheelAcc = 0;
      h.release();
    }
  };

  dom.addEventListener("pointerdown", onDown);
  dom.addEventListener("pointermove", onMove);
  dom.addEventListener("pointerup", onUp);
  dom.addEventListener("pointercancel", onCancel);
  dom.addEventListener("lostpointercapture", onLost);
  dom.addEventListener("wheel", onWheel, { passive: false });
  return {
    setInteractive(on) {
      interactive = on;
      if (!on) cancel(true);
    },
    dispose() {
      interactive = false;
      cancel(false);
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointercancel", onCancel);
      dom.removeEventListener("lostpointercapture", onLost);
      dom.removeEventListener("wheel", onWheel);
    },
  };
}
